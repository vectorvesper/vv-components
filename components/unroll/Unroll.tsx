"use client";

/**
 * Unroll — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
/**
 * Unroll: an image rolled up like a scroll, in grey. Point at it, or tap it,
 * and it unrolls flat as its colour comes in; move away and it rolls back up.
 *
 * Runs on the Vector Vesper runtime: it stops drawing off screen, drops its
 * resolution on a slow device, comes back after a lost graphics context, and
 * shows the plain image under reduced motion.
 */

import { getSensorBus } from "@vectorvesper/motion";
import { useThreeScene } from "@vectorvesper/motion/three";
import React, { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

export interface UnrollProps {
  /** The image. */
  src: string;
  /** What the image shows, for screen readers. */
  alt: string;
  /** How many times the image wraps round when rolled. Default 2. */
  turns?: number;
  /** How thick the roll is, as a share of the image's width. Default 0.17. */
  radius?: number;
  /** How quickly it unrolls and rolls back. Default 2. */
  speed?: number;
  /** Rolled up, the image is grey, and its colour comes in as it opens. Default true. */
  grayscale?: boolean;
  /** How far open it rests, 0 rolled to 1 flat. Default 0. */
  rest?: number;
  /** Sizes the area. The image fits inside it, whole. Without a height it is 100svh tall. */
  className?: string;
  style?: React.CSSProperties;
}

const FOV = 40;
const DISTANCE = 5;
// Room left round the image for the roll
const MARGIN = 0.86;
// Along the image only; it never bends the other way
const SEGMENTS = 160;

const VERTEX = /* glsl */ `
  uniform vec2 uSize;
  uniform float uProgress;
  uniform float uRadius;
  uniform float uTurns;
  varying vec2 vUv;
  varying float vShade;

  const float PI = 3.14159265359;

  void main() {
    vUv = uv;
    vec3 flatPos = vec3((uv.x - 0.5) * uSize.x, (uv.y - 0.5) * uSize.y, 0.0);

    // Rolled, the strip winds inward along its length
    float r = uRadius * uSize.x * (1.0 - uv.x * 0.8);
    float a = uv.x * PI * 2.0 * uTurns;
    vec3 rolled = vec3(r * cos(a), flatPos.y, r * sin(a));

    // The side of the roll facing away from the light is darker
    vShade = mix(0.62 + 0.38 * (0.5 + 0.5 * sin(a)), 1.0, uProgress);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(rolled, flatPos, uProgress), 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uImage;
  uniform float uProgress;
  uniform float uGray;
  uniform float uReady;
  varying vec2 vUv;
  varying float vShade;

  void main() {
    vec3 col = texture2D(uImage, vUv).rgb;
    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, mix(vec3(gray), col, uProgress), uGray);
    col *= vShade;
    // The back of the paper is dark
    if (!gl_FrontFacing) col *= 0.3;
    gl_FragColor = vec4(col, uReady);
  }
`;

export function Unroll({
  src,
  alt,
  turns = 2,
  radius = 0.17,
  speed = 2,
  grayscale = true,
  rest = 0,
  className = "",
  style,
}: UnrollProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const place = useRef({ left: 0, top: 0 });
  // Read each frame, so changing a prop never rebuilds the scene
  const props = useRef({ turns, radius, speed, grayscale, rest });
  useLayoutEffect(() => {
    props.current = { turns, radius, speed, grayscale, rest };
  });

  // Where the area sits on the page, so the shared pointer can be read against it
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const r = root.getBoundingClientRect();
      place.current = { left: r.left + window.scrollX, top: r.top + window.scrollY };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, []);

  const { ref, mounted } = useThreeScene({
    label: "Unroll",
    cost: "light",
    renderer: () => {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      r.setClearColor(0x000000, 0);
      return r;
    },
    setup() {
      // The shared sensors only listen while someone holds them
      const releaseSensors = getSensorBus().retain();

      let imageAspect = 0;
      const texture = new THREE.TextureLoader().load(src, (tex) => {
        const img = tex.image as HTMLImageElement;
        imageAspect = img.width / Math.max(1, img.height);
        uniforms.uReady.value = 1;
      });
      // Drawn as stored, so the image keeps its own colours
      texture.colorSpace = THREE.NoColorSpace;
      texture.anisotropy = 4;

      const uniforms = {
        uImage: { value: texture },
        uSize: { value: new THREE.Vector2(1, 1) },
        uProgress: { value: props.current.rest },
        uRadius: { value: 0.17 },
        uTurns: { value: 2 },
        uGray: { value: 1 },
        uReady: { value: 0 },
      };
      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms,
        side: THREE.DoubleSide,
        transparent: true,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, SEGMENTS, 1), material);
      // The shader moves every vertex, so the plane's own bounds mean nothing
      mesh.frustumCulled = false;
      const scene = new THREE.Scene();
      scene.add(mesh);
      const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
      camera.position.z = DISTANCE;

      return {
        scene,
        camera,
        dispose() {
          releaseSensors();
          texture.dispose();
        },
        update(frame) {
          const p = props.current;
          const dt = Math.min(frame.dt, 1 / 20);
          uniforms.uRadius.value = p.radius;
          uniforms.uTurns.value = p.turns;
          uniforms.uGray.value = p.grayscale ? 1 : 0;

          // Fit the image inside the view, whole
          const fullH = 2 * DISTANCE * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
          const aspect = frame.width / Math.max(1, frame.height);
          if (imageAspect) {
            const h = Math.min(fullH * MARGIN, (fullH * MARGIN * aspect) / imageAspect);
            uniforms.uSize.value.set(h * imageAspect, h);
          }

          // Open while the pointer is over the image itself, measured flat
          const pxPerUnit = frame.height / fullH;
          const halfW = (uniforms.uSize.value.x * pxPerUnit) / 2;
          const halfH = (uniforms.uSize.value.y * pxPerUnit) / 2;
          const bus = getSensorBus().state;
          const x = bus.pointer.x - (place.current.left - bus.scroll.x) - frame.width / 2;
          const y = bus.pointer.y - (place.current.top - bus.scroll.y) - frame.height / 2;
          const over = imageAspect > 0 && bus.pointer.seen && Math.abs(x) <= halfW && Math.abs(y) <= halfH;
          const target = over ? 1 : p.rest;
          uniforms.uProgress.value += (target - uniforms.uProgress.value) * (1 - Math.exp(-dt * p.speed * 1.6));
        },
      };
    },
  });

  return (
    <div
      ref={rootRef}
      className={`vv-unroll ${className}`}
      role="img"
      aria-label={alt}
      data-live={mounted ? "" : undefined}
      style={{ "--vv-ur-image": `url("${src}")`, ...style } as React.CSSProperties}
    >
      <style>{STYLES}</style>
      <div ref={ref} className="vv-ur-scene" aria-hidden="true" />
    </div>
  );
}

export default Unroll;

const STYLES = `
/* Zero specificity, so a class that sizes the component wins. */
:where(.vv-unroll) { position: relative; min-height: 100svh; }
/* The plain image shows until the scene is drawn, and in its place under reduced motion. */
.vv-unroll { background: var(--vv-ur-image) center / auto 86% no-repeat; }
.vv-unroll[data-live] { background: none; }
.vv-ur-scene { position: absolute; inset: 0; }
`;
