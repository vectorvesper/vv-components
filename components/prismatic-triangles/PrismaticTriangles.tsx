"use client";

/**
 * Prismatic Triangles — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
/**
 * Prismatic Triangles: an image seen through a wall of cut glass. Each triangle
 * is tilted its own way, so it bends its piece of the image and splits it
 * slightly into colour, and a slowly turning light glints off the faces. Near
 * the pointer the facets lean toward it and their edges catch the light. Made
 * as a hero background; put your content inside it.
 *
 * Runs on the Vector Vesper runtime: it stops drawing off screen, drops its
 * resolution on a slow device, comes back after a lost graphics context, and
 * shows the plain image under reduced motion.
 */

import { getSensorBus } from "@vectorvesper/motion";
import { useThreeScene } from "@vectorvesper/motion/three";
import React, { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

export interface PrismaticTrianglesProps {
  /** The image behind the glass. It fills the area the way `object-fit: cover` does. */
  src: string;
  /** Which part of the image stays in view when it is cropped, as CSS `object-position`. Default "50% 50%". */
  position?: string;
  /** How many triangles fit the height. Default 5. */
  density?: number;
  /** How far each facet bends the image, as a share of the height. Default 0.035. */
  refraction?: number;
  /** How much the bent image splits into colour, 0 to 1. Default 0.35. */
  dispersion?: number;
  /** How far the facets lean, 0 to 2. Default 0.8. */
  tilt?: number;
  /** How fast the light turns. Default 0.25. */
  speed?: number;
  /** How bright the edges near the pointer get. 0 turns it off. Default 1. */
  glow?: number;
  /** How far the pointer reaches, as a share of the height. Default 0.45. */
  reach?: number;
  /** Sizes the area. Without a height it is 100svh tall. */
  className?: string;
  style?: React.CSSProperties;
  /** Content drawn over the glass. */
  children?: React.ReactNode;
}

// How quickly the facets follow the pointer, and the glow comes and goes
const FOLLOW = 6;
const FADE = 3;

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
  uniform float uHover;
  uniform float uDensity;
  uniform float uRefraction;
  uniform float uDispersion;
  uniform float uTilt;
  uniform float uSpeed;
  uniform float uGlow;
  uniform float uReach;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec2 cover(vec2 uv) {
    return uFit.zw + uv * uFit.xy;
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uAspect;

    // Skew the plane so each unit cell splits into two triangles
    vec2 q = uv * uDensity;
    q = vec2(1.1547 * q.x, q.y + 0.57735 * q.x);
    vec2 cell = floor(q);
    vec2 f = fract(q);
    float upper = step(f.x, f.y);
    vec2 id = cell + upper * 10.0;

    // Each facet leans its own way
    vec3 n = vec3((hash(id) - 0.5) * uTilt, (hash(id + 1.0) - 0.5) * uTilt, 1.0);

    // Near the pointer the facets lean toward it
    vec2 toPointer = uv - uPointer;
    float near = uHover * smoothstep(uReach, 0.0, length(toPointer));
    n.xy += toPointer * near * 0.6;
    n = normalize(n);

    // The facet bends the image behind it; each colour bends a little differently
    vec2 bend = n.xy * uRefraction * vec2(1.0 / uAspect, 1.0);
    vec2 base = cover(vUv);
    vec2 spread = bend * uDispersion;
    vec3 col = vec3(
      texture2D(uImage, base + bend + spread).r,
      texture2D(uImage, base + bend).g,
      texture2D(uImage, base + bend - spread).b
    );

    // A slowly turning light glints off the faces
    vec3 ref = reflect(normalize(vec3(uv * 0.5, -1.0)), n);
    float t = uTime * uSpeed;
    vec3 light = normalize(vec3(sin(t), cos(t * 0.8), -1.4));
    float glint = pow(max(dot(ref, light), 0.0), 18.0);
    col += glint * 0.22;

    // Every edge is a thin bevel; near the pointer it catches the light
    float edge = min(abs(f.x - f.y), upper > 0.5 ? min(f.x, 1.0 - f.y) : min(f.y, 1.0 - f.x));
    float line = 1.0 - smoothstep(0.0, fwidth(q.y) * 1.4, edge);
    col = mix(col, vec3(1.0), line * (0.1 + 0.7 * near * uGlow));

    gl_FragColor = vec4(col, uReady);
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

export function PrismaticTriangles({
  src,
  position = "50% 50%",
  density = 5,
  refraction = 0.035,
  dispersion = 0.35,
  tilt = 0.8,
  speed = 0.25,
  glow = 1,
  reach = 0.45,
  className = "",
  style,
  children,
}: PrismaticTrianglesProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const place = useRef({ left: 0, top: 0 });
  // Read each frame, so changing a prop never rebuilds the scene
  const props = useRef({ position, density, refraction, dispersion, tilt, speed, glow, reach });
  useLayoutEffect(() => {
    props.current = { position, density, refraction, dispersion, tilt, speed, glow, reach };
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
    label: "PrismaticTriangles",
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
      // Mipmapped, so the bent samples stay smooth when the image is scaled down
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.wrapS = THREE.MirroredRepeatWrapping;
      texture.wrapT = THREE.MirroredRepeatWrapping;

      const uniforms = {
        uImage: { value: texture },
        uFit: { value: new THREE.Vector4(1, 1, 0, 0) },
        uReady: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uPointer: { value: new THREE.Vector2() },
        uHover: { value: 0 },
        uDensity: { value: 5 },
        uRefraction: { value: 0.035 },
        uDispersion: { value: 0.35 },
        uTilt: { value: 0.8 },
        uSpeed: { value: 0.25 },
        uGlow: { value: 1 },
        uReach: { value: 0.9 },
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
          uniforms.uDensity.value = p.density;
          uniforms.uRefraction.value = p.refraction;
          uniforms.uDispersion.value = p.dispersion;
          uniforms.uTilt.value = p.tilt;
          uniforms.uSpeed.value = p.speed;
          uniforms.uGlow.value = p.glow;
          uniforms.uReach.value = p.reach * 2;

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

          // The pointer in the shader's space: -1 to 1 up the height, centred
          const bus = getSensorBus().state;
          const x = bus.pointer.x - (place.current.left - bus.scroll.x);
          const y = bus.pointer.y - (place.current.top - bus.scroll.y);
          const inside = bus.pointer.seen && x >= 0 && x <= frame.width && y >= 0 && y <= frame.height;
          const px = ((x / frame.width) * 2 - 1) * aspect;
          const py = 1 - (y / frame.height) * 2;
          const target = uniforms.uPointer.value;
          if (inside) {
            if (!placed) {
              target.set(px, py);
              placed = true;
            }
            const k = 1 - Math.exp(-dt * FOLLOW);
            target.x += (px - target.x) * k;
            target.y += (py - target.y) * k;
          }
          const h = 1 - Math.exp(-dt * FADE);
          uniforms.uHover.value += ((inside ? 1 : 0) - uniforms.uHover.value) * h;
        },
      };
    },
  });

  return (
    <div
      ref={rootRef}
      className={`vv-prismatic ${className}`}
      data-live={mounted ? "" : undefined}
      style={{ "--vv-pt-image": `url("${src}")`, "--vv-pt-position": position, ...style } as React.CSSProperties}
    >
      <style>{STYLES}</style>
      <div ref={ref} className="vv-pt-scene" aria-hidden="true" />
      {children}
    </div>
  );
}

export default PrismaticTriangles;

const STYLES = `
/* Zero specificity, so a class that sizes the component wins. */
:where(.vv-prismatic) { position: relative; min-height: 100svh; }
/* The plain image shows until the glass is drawn, and in its place under reduced motion. */
.vv-prismatic { isolation: isolate; overflow: hidden; background: #111 var(--vv-pt-image) var(--vv-pt-position) / cover no-repeat; }
.vv-pt-scene { position: absolute; inset: 0; z-index: -1; }
`;
