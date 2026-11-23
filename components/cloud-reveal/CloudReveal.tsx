"use client";

/**
 * Cloud Reveal — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
/**
 * Cloud Reveal: an image under a drifting mist. Where the pointer goes, the
 * mist parts in a soft, ragged opening and the image shows through; when the
 * pointer leaves, the mist closes over it again.
 *
 * Runs on the Vector Vesper runtime: it stops drawing off screen, drops its
 * resolution and a layer of the mist's detail on a slow device, comes back
 * after a lost graphics context, and shows the plain image under reduced motion.
 */

import { getSensorBus } from "@vectorvesper/motion";
import { useThreeScene } from "@vectorvesper/motion/three";
import React, { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

export interface CloudRevealProps {
  /** The image under the mist. It fills the area the way `object-fit: cover` does. */
  src: string;
  /** What the image shows, for screen readers. */
  alt: string;
  /** Which part of the image stays in view when it is cropped, as CSS `object-position`. Default "50% 50%". */
  position?: string;
  /** The colour of the mist. Default "#f4f3f0". */
  color?: string;
  /** How much of the image the mist hides, 0 to 1. Default 1. */
  opacity?: number;
  /** The size of the opening, as a share of the height. Default 0.3. */
  radius?: number;
  /** How soft the opening's edge is. Default 0.1. */
  softness?: number;
  /** How ragged the opening's edge is. Default 0.15. */
  roughness?: number;
  /** How fine the mist's grain is. Default 4. */
  scale?: number;
  /** How fast the mist drifts. Default 0.5. */
  speed?: number;
  /** How much the image ripples around the opening. Default 0. */
  distortion?: number;
  /** Sizes the area. Without a height it is 100svh tall. */
  className?: string;
  style?: React.CSSProperties;
  /** Content drawn over the mist. */
  children?: React.ReactNode;
}

// How quickly the opening follows the pointer, and opens and closes
const FOLLOW = 7;
const OPEN = 4;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uImage;
  uniform vec4 uFit;
  uniform float uReady;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uPointer;
  uniform float uOpen;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uRadius;
  uniform float uSoftness;
  uniform float uRoughness;
  uniform float uScale;
  uniform float uSpeed;
  uniform float uDistortion;
  uniform float uOctaves;
  varying vec2 vUv;

  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      // The runtime asks for one layer fewer when it turns quality down
      if (float(i) >= uOctaves) break;
      value += amp * snoise(p + uTime * uSpeed);
      p *= 2.0;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    // Square units, so the opening and the mist stay round on any screen
    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    float noise = fbm(p * uScale);

    float d = length(p - uPointer) - noise * uRoughness;
    float r = uRadius * uOpen;
    float mask = smoothstep(r + uSoftness, r - uSoftness, d) * step(0.001, uOpen);

    vec2 uv = vUv;
    // A ripple in the image just inside the edge, only when asked for
    if (uDistortion > 0.0 && mask > 0.0 && mask < 1.0) {
      uv += vec2(snoise(p * 3.0 + uTime * 0.3), snoise(p * 3.0 + 100.0 + uTime * 0.3)) * uDistortion * (1.0 - mask);
    }
    vec3 image = texture2D(uImage, uFit.zw + uv * uFit.xy).rgb;

    // The mist is lighter and darker in drifts, from the same noise as the edge
    vec3 mist = uColor * (0.94 + 0.06 * noise);
    vec3 cover = mix(image, mist, uOpacity);

    gl_FragColor = vec4(mix(cover, image, mask), uReady);
  }
`;

/** Parses "x% y%" into 0 to 1 fractions, the way object-position does for percentages. */
function parsePosition(value: string): [number, number] {
  const parts = value.trim().split(/\s+/);
  const read = (s: string | undefined) => {
    if (!s) return 0.5;
    if (s === "left" || s === "top") return 0;
    if (s === "right" || s === "bottom") return 1;
    if (s === "center") return 0.5;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n / 100 : 0.5;
  };
  return [read(parts[0]), read(parts[1] ?? parts[0])];
}

export function CloudReveal({
  src,
  alt,
  position = "50% 50%",
  color = "#f4f3f0",
  opacity = 1,
  radius = 0.3,
  softness = 0.1,
  roughness = 0.15,
  scale = 4,
  speed = 0.5,
  distortion = 0,
  className = "",
  style,
  children,
}: CloudRevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const place = useRef({ left: 0, top: 0 });
  // Read each frame, so changing a prop never rebuilds the scene
  const props = useRef({ position, color, opacity, radius, softness, roughness, scale, speed, distortion });
  useLayoutEffect(() => {
    props.current = { position, color, opacity, radius, softness, roughness, scale, speed, distortion };
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

  const { ref, mounted, cause } = useThreeScene({
    label: "CloudReveal",
    cost: "light",
    renderer: () => {
      const r = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
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
      texture.wrapS = THREE.MirroredRepeatWrapping;
      texture.wrapT = THREE.MirroredRepeatWrapping;

      const uniforms = {
        uImage: { value: texture },
        uFit: { value: new THREE.Vector4(1, 1, 0, 0) },
        uReady: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uOpen: { value: 0 },
        uColor: { value: new THREE.Color() },
        uOpacity: { value: 1 },
        uRadius: { value: 0.3 },
        uSoftness: { value: 0.1 },
        uRoughness: { value: 0.15 },
        uScale: { value: 4 },
        uSpeed: { value: 0.5 },
        uDistortion: { value: 0 },
        uOctaves: { value: 4 },
      };
      const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms, transparent: true });
      // One quad over the whole canvas; the shader works in its own space
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      quad.frustumCulled = false;
      const scene = new THREE.Scene();
      scene.add(quad);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      let placed = false;
      let fitKey = "";
      let lastColor = "";

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
          const aspect = frame.width / Math.max(1, frame.height);
          uniforms.uTime.value = frame.time;
          uniforms.uAspect.value = aspect;
          uniforms.uOpacity.value = p.opacity;
          uniforms.uRadius.value = p.radius;
          uniforms.uSoftness.value = p.softness;
          uniforms.uRoughness.value = p.roughness;
          uniforms.uScale.value = p.scale;
          uniforms.uSpeed.value = p.speed;
          uniforms.uDistortion.value = p.distortion;
          uniforms.uOctaves.value = frame.quality === "full" ? 4 : 3;
          if (p.color !== lastColor) {
            lastColor = p.color;
            uniforms.uColor.value.set(p.color);
          }

          // Fill the area the way object-fit: cover fills a box
          const key = `${imageAspect}|${aspect}|${p.position}`;
          if (imageAspect && key !== fitKey) {
            fitKey = key;
            const [ox, oy] = parsePosition(p.position);
            if (imageAspect > aspect) {
              const sx = aspect / imageAspect;
              uniforms.uFit.value.set(sx, 1, (1 - sx) * ox, 0);
            } else {
              const sy = imageAspect / aspect;
              // Texture rows run bottom to top, so the vertical offset is measured from the bottom
              uniforms.uFit.value.set(1, sy, 0, (1 - sy) * (1 - oy));
            }
          }

          // The pointer in the shader's square units, from the bottom left
          const bus = getSensorBus().state;
          const x = bus.pointer.x - (place.current.left - bus.scroll.x);
          const y = bus.pointer.y - (place.current.top - bus.scroll.y);
          const inside = bus.pointer.seen && x >= 0 && x <= frame.width && y >= 0 && y <= frame.height;
          const px = (x / frame.width) * aspect;
          const py = 1 - y / frame.height;
          const target = uniforms.uPointer.value;
          if (inside) {
            // The first opening starts where the pointer is, rather than sliding in
            if (!placed || uniforms.uOpen.value < 0.01) {
              target.set(px, py);
              placed = true;
            }
            const k = 1 - Math.exp(-dt * FOLLOW);
            target.x += (px - target.x) * k;
            target.y += (py - target.y) * k;
          }
          const o = 1 - Math.exp(-dt * OPEN);
          uniforms.uOpen.value += ((inside ? 1 : 0) - uniforms.uOpen.value) * o;
        },
      };
    },
  });

  // No mist at all, rather than mist that never parts
  const plain = !mounted && (cause === "reduced-motion" || cause === "device-floor");

  return (
    <div
      ref={rootRef}
      className={`vv-cloud-reveal ${className}`}
      data-plain={plain ? "" : undefined}
      role="img"
      aria-label={alt}
      data-live={mounted ? "" : undefined}
      style={
        {
          "--vv-cr-image": `url("${src}")`,
          "--vv-cr-position": position,
          "--vv-cr-color": color,
          ...style,
        } as React.CSSProperties
      }
    >
      <style>{STYLES}</style>
      <div ref={ref} className="vv-cr-scene" aria-hidden="true" />
      {children}
    </div>
  );
}

export default CloudReveal;

const STYLES = `
/* Zero specificity, so a class that sizes the component wins. */
:where(.vv-cloud-reveal) { position: relative; min-height: 100svh; }
/* Mist until the scene is drawn; the plain image under reduced motion. */
.vv-cloud-reveal { isolation: isolate; overflow: hidden; background: var(--vv-cr-color); }
.vv-cloud-reveal[data-plain] { background: var(--vv-cr-image) var(--vv-cr-position) / cover no-repeat; }
.vv-cr-scene { position: absolute; inset: 0; z-index: -1; }
`;
