"use client";

/**
 * Energy Web — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
/**
 * Energy Web: threads of energy streaming out from a bright core. Near the
 * pointer the threads twist and crackle, and a glow in the accent colour
 * follows it. Made as a hero background; put your content inside it.
 *
 * Runs on the Vector Vesper runtime: it stops drawing off screen, drops its
 * resolution and its finer threads on a slow device, comes back after a lost
 * graphics context, and shows a still glow under reduced motion.
 */

import { getSensorBus } from "@vectorvesper/motion";
import { useThreeScene } from "@vectorvesper/motion/three";
import React, { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

export interface EnergyWebProps {
  /** The colour of the threads. Default "#8ff5e0". */
  color?: string;
  /** The glow that follows the pointer. Default "#f2f0ea". */
  accent?: string;
  /** The colour behind everything. On a light colour the threads are drawn as ink. Default "#000000". */
  background?: string;
  /** How many main threads go round the core. Default 9. */
  threads?: number;
  /** How fast the energy streams outward. Default 0.35. */
  speed?: number;
  /** How bright the threads are. Default 1.6. */
  intensity?: number;
  /** How far the pointer reaches, as a share of the height. Default 0.25. */
  reach?: number;
  /**
   * Where the core sits, as fractions of the width and height from the top left.
   * Past an edge, the threads come in from off screen. Default [0.92, -0.06],
   * just past the top right corner.
   */
  origin?: [number, number];
  /** How far the threads reach from the core. Default 2. */
  spread?: number;
  /** How bright the core is. 0 hides it. Default 1.6. */
  core?: number;
  /** Sizes the area. Without a height it is 100svh tall. */
  className?: string;
  style?: React.CSSProperties;
  /** Content drawn over the energy. */
  children?: React.ReactNode;
}

// How quickly the twist follows the pointer, and comes and goes
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
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uPointer;
  uniform float uHover;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform vec3 uBackground;
  uniform float uThreads;
  uniform float uSpeed;
  uniform float uIntensity;
  uniform float uReach;
  uniform float uDetail;
  uniform vec2 uOrigin;
  uniform float uSpread;
  uniform float uCore;
  uniform float uLight;
  varying vec2 vUv;

  float grain(vec2 c) {
    return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  }

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

  void main() {
    vec2 screen = vUv * 2.0 - 1.0;
    screen.x *= uAspect;
    vec2 p = screen - uOrigin;
    float dist = length(p);
    float angle = atan(p.y, p.x);

    float pointerDist = length(screen - uPointer);
    float near = uHover * smoothstep(uReach, 0.0, pointerDist);

    // Near the pointer the threads twist
    angle += near * (1.8 * sin(uTime * 3.0) + 0.8);
    // Sampled on a circle, so the pattern has no seam where the angle wraps
    vec2 around = vec2(cos(angle), sin(angle));

    float branch = snoise(around * uThreads + vec2(dist * 1.5 - uTime * uSpeed, near * 2.0));
    // Finer threads, left out when the runtime turns quality down
    if (uDetail > 0.5) {
      branch += 0.5 * snoise(around * uThreads * 2.0 + vec2(dist * 4.0, uTime * uSpeed * 2.4));
    }
    // Crackle, only where the pointer is
    if (near > 0.001) {
      branch += 1.5 * near * snoise(around * 30.0 + vec2(uTime * 8.0, dist * 12.0));
    }

    float energy = 0.02 / (abs(branch) + 0.05);
    energy *= smoothstep(0.0, 0.2, dist) * (1.0 - smoothstep(0.8 * uSpread, 1.5 * uSpread, dist)) * uIntensity;

    // Both glows end within reach, so the ground between the threads stays clean
    float coreGlow = uCore * 0.05 / (dist + 0.05) * (1.0 - smoothstep(0.0, 0.9 * uSpread, dist));
    float pointerGlow = uHover * 0.08 / (pointerDist + 0.04) * (1.0 - smoothstep(0.0, 0.7, pointerDist));
    // Softly fainter toward the edges
    vec2 e = vUv - 0.5;
    float edge = 1.0 - smoothstep(0.35, 0.9, length(e * vec2(1.0, 1.2))) * 0.7;

    vec3 col;
    if (uLight > 0.5) {
      // On a light ground the threads are ink: each layer covers the one below
      col = uBackground;
      col = mix(col, uColor, (1.0 - exp(-coreGlow * edge)) * 0.45);
      col = mix(col, uColor, 1.0 - exp(-energy * edge * 1.6));
      col = mix(col, uAccent, (1.0 - exp(-pointerGlow * 1.2)) * 0.85);
    } else {
      // On a dark ground they are light, and bright parts roll off instead of clipping
      col = uColor * energy + vec3(0.6) * coreGlow + uAccent * pointerGlow;
      col = vec3(1.0) - exp(-col * edge * 1.6) + uBackground;
    }

    // A trace of grain, so the dark gradients never band
    col += grain(gl_FragCoord.xy + fract(uTime) * 97.0) * (1.5 / 255.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function EnergyWeb({
  color = "#8ff5e0",
  accent = "#f2f0ea",
  background = "#000000",
  threads = 9,
  speed = 0.35,
  intensity = 1.6,
  reach = 0.25,
  origin = [0.92, -0.06],
  spread = 2,
  core = 1.6,
  className = "",
  style,
  children,
}: EnergyWebProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const place = useRef({ left: 0, top: 0 });
  // Read each frame, so changing a prop never rebuilds the scene
  const props = useRef({ color, accent, background, threads, speed, intensity, reach, origin, spread, core });
  useLayoutEffect(() => {
    props.current = { color, accent, background, threads, speed, intensity, reach, origin, spread, core };
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
    label: "EnergyWeb",
    cost: "light",
    renderer: () => new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" }),
    setup() {
      // The shared sensors only listen while someone holds them
      const releaseSensors = getSensorBus().retain();

      const uniforms = {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uPointer: { value: new THREE.Vector2() },
        uHover: { value: 0 },
        uColor: { value: new THREE.Color() },
        uAccent: { value: new THREE.Color() },
        uBackground: { value: new THREE.Color() },
        uThreads: { value: 8 },
        uSpeed: { value: 0.5 },
        uIntensity: { value: 1 },
        uReach: { value: 0.5 },
        uDetail: { value: 1 },
        uOrigin: { value: new THREE.Vector2() },
        uSpread: { value: 1 },
        uCore: { value: 1 },
        uLight: { value: 0 },
      };
      const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms });
      // One quad over the whole canvas; the shader works in its own space
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      quad.frustumCulled = false;
      const scene = new THREE.Scene();
      scene.add(quad);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      let placed = false;
      let lastColors = "";

      return {
        scene,
        camera,
        dispose: releaseSensors,
        update(frame) {
          const p = props.current;
          const dt = Math.min(frame.dt, 1 / 20);
          const aspect = frame.width / Math.max(1, frame.height);
          uniforms.uTime.value = frame.time;
          uniforms.uAspect.value = aspect;
          uniforms.uThreads.value = p.threads;
          uniforms.uSpeed.value = p.speed;
          uniforms.uIntensity.value = p.intensity;
          uniforms.uReach.value = p.reach * 2;
          uniforms.uDetail.value = frame.quality === "full" ? 1 : 0;
          uniforms.uOrigin.value.set((p.origin[0] * 2 - 1) * aspect, 1 - p.origin[1] * 2);
          uniforms.uSpread.value = p.spread;
          uniforms.uCore.value = p.core;

          const key = `${p.color}|${p.accent}|${p.background}`;
          if (key !== lastColors) {
            lastColors = key;
            uniforms.uColor.value.set(p.color);
            uniforms.uAccent.value.set(p.accent);
            uniforms.uBackground.value.set(p.background);
            // A light ground draws the threads as ink rather than light
            const bg = uniforms.uBackground.value;
            uniforms.uLight.value = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b > 0.4 ? 1 : 0;
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
      className={`vv-energy-web ${className}`}
      data-live={mounted ? "" : undefined}
      style={
        {
          "--vv-ew-color": color,
          "--vv-ew-bg": background,
          "--vv-ew-origin": `${origin[0] * 100}% ${origin[1] * 100}%`,
          ...style,
        } as React.CSSProperties
      }
    >
      <style>{STYLES}</style>
      <div ref={ref} className="vv-ew-scene" aria-hidden="true" />
      {children}
    </div>
  );
}

export default EnergyWeb;

const STYLES = `
/* Zero specificity, so a class that sizes the component wins. */
:where(.vv-energy-web) { position: relative; min-height: 100svh; }
/* A still glow until the energy is drawn, and in its place under reduced motion. */
.vv-energy-web {
  isolation: isolate; overflow: hidden;
  background: radial-gradient(circle at var(--vv-ew-origin), color-mix(in srgb, var(--vv-ew-color) 45%, transparent) 0, transparent 38%), var(--vv-ew-bg);
}
.vv-ew-scene { position: absolute; inset: 0; z-index: -1; }
`;
