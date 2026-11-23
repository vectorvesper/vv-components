"use client";

/**
 * Wavy Grid — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
/**
 * Wavy Grid: a grid of fine lines rippling in slow, layered waves and drifting
 * upward, brighter where the waves crest. The pointer raises a soft swell
 * wherever it goes. Made as a hero background; put your content inside it.
 *
 * Runs on the Vector Vesper runtime: it stops drawing off screen, drops its
 * resolution and mesh detail on a slow device, comes back after a lost graphics
 * context, and shows a still grid under reduced motion.
 */

import { getSensorBus } from "@vectorvesper/motion";
import { useThreeScene } from "@vectorvesper/motion/three";
import React, { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

export interface WavyGridProps {
  /** The colour of the lines in the troughs. Default "#b8c2ea". */
  color?: string;
  /** The colour the lines take on the crests. Default "#2438a8". */
  highlight?: string;
  /** The colour behind the grid. Default "#f4f3f0". */
  background?: string;
  /** How many grid cells fit the height. Default 22. */
  density?: number;
  /** How tall the waves are. 0 keeps the grid flat. Default 0.8. */
  amplitude?: number;
  /** How fast the waves move. Default 0.6. */
  speed?: number;
  /** How fast the grid drifts upward. 0 holds it still. Default 0.05. */
  drift?: number;
  /** How high the pointer raises the grid. 0 turns it off. Default 1.2. */
  swell?: number;
  /** How far the swell spreads, as a share of the height. Default 0.25. */
  reach?: number;
  /** Fades the grid out toward the edges. Default true. */
  fade?: boolean;
  /** Sizes the area. Without a height it is 100svh tall. */
  className?: string;
  style?: React.CSSProperties;
  /** Content drawn over the grid. */
  children?: React.ReactNode;
}

// How quickly the swell follows the pointer, and comes and goes
const FOLLOW = 5;
const FADE = 3;
// Mesh detail along each side, by quality
const SEGMENTS = { full: 160, reduced: 80 };

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uAmplitude;
  uniform vec2 uPointer;
  uniform float uSwell;
  uniform float uReach;
  uniform vec2 uScale;
  varying vec2 vGrid;
  varying vec2 vScreen;
  varying float vHeight;

  void main() {
    // The unit plane stretched to the area, in units of its height
    vec2 w = position.xy * uScale;
    float t = uTime * 0.6;

    // Three waves: long and slow, shorter and quicker, and a cross ripple
    float h = sin(w.x * 3.0 + t * 0.3) * 0.2;
    h += sin(w.x * 10.0 + t) * 0.05;
    h += sin(w.y * 15.0 + t) * 0.05;
    h *= uAmplitude;

    // A soft swell under the pointer
    vec2 d = w - uPointer;
    h += uSwell * 0.12 * exp(-dot(d, d) / (uReach * uReach));

    // The grid is laid out before it moves, so the lines ripple with the waves
    vGrid = w;
    vHeight = h;
    vScreen = vec2(w.x, w.y + h - 0.02);
    gl_Position = projectionMatrix * vec4(vScreen, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uDensity;
  uniform float uDrift;
  uniform float uAspect;
  uniform float uFade;
  uniform vec3 uColor;
  uniform vec3 uHighlight;
  uniform vec3 uBackground;
  varying vec2 vGrid;
  varying vec2 vScreen;
  varying float vHeight;

  void main() {
    vec2 g = vGrid * uDensity;
    g.y -= uTime * uDrift * uDensity * 0.1;

    // Distance to the nearest line, in cells, and the same in pixels
    vec2 cell = abs(fract(g) - 0.5);
    vec2 px = cell / fwidth(g);
    float d = min(px.x, px.y);

    // A hairline under a pixel wide, with a faint glow around it
    float line = 1.0 - smoothstep(0.0, 0.9, d);
    float glow = exp(-min(cell.x, cell.y) * 22.0) * 0.12;

    // Troughs fade into the ground and crests stand out, on a light or dark ground
    float crest = smoothstep(-0.12, 0.28, vHeight);
    vec3 tint = mix(uColor, uHighlight, crest);
    float ink = clamp((line + glow * crest) * mix(0.35, 1.0, crest), 0.0, 1.0);
    vec3 col = mix(uBackground, tint, ink);

    // Fades out toward the edges of the area, in an oval that fits it
    vec2 e = vScreen / vec2(uAspect * 0.5, 0.5);
    float fade = mix(1.0, smoothstep(1.15, 0.35, length(e)), uFade);
    gl_FragColor = vec4(mix(uBackground, col, fade), 1.0);
  }
`;

export function WavyGrid({
  color = "#b8c2ea",
  highlight = "#2438a8",
  background = "#f4f3f0",
  density = 22,
  amplitude = 0.8,
  speed = 0.6,
  drift = 0.05,
  swell = 1.2,
  reach = 0.25,
  fade = true,
  className = "",
  style,
  children,
}: WavyGridProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const place = useRef({ left: 0, top: 0 });
  // Read each frame, so changing a prop never rebuilds the scene
  const props = useRef({ color, highlight, background, density, amplitude, speed, drift, swell, reach, fade });
  useLayoutEffect(() => {
    props.current = { color, highlight, background, density, amplitude, speed, drift, swell, reach, fade };
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
    label: "WavyGrid",
    cost: "light",
    renderer: () => new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" }),
    setup({ renderer, quality }) {
      // The shared sensors only listen while someone holds them
      const releaseSensors = getSensorBus().retain();

      const uniforms = {
        uTime: { value: 0 },
        uAmplitude: { value: 1 },
        uPointer: { value: new THREE.Vector2(0, -2) },
        uSwell: { value: 0 },
        uReach: { value: 0.25 },
        uDensity: { value: 15 },
        uDrift: { value: 0.1 },
        uAspect: { value: 1 },
        uScale: { value: new THREE.Vector2(1, 1) },
        uFade: { value: 1 },
        uColor: { value: new THREE.Color() },
        uHighlight: { value: new THREE.Color() },
        uBackground: { value: new THREE.Color() },
      };
      const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms });
      // A unit plane the shader stretches to the area; the waves need the vertices
      const segments = SEGMENTS[quality];
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, segments, segments), material);
      mesh.frustumCulled = false;
      const scene = new THREE.Scene();
      scene.add(mesh);
      // One unit is the area's height, centred
      const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1);

      let swellTarget = 0;
      let placed = false;
      let lastColors = "";
      let time = 0;

      return {
        scene,
        camera,
        dispose: releaseSensors,
        resize(width, height) {
          const aspect = width / Math.max(1, height);
          camera.left = -aspect / 2;
          camera.right = aspect / 2;
          camera.updateProjectionMatrix();
          // Overscanned, so the waves never pull an edge into view
          uniforms.uScale.value.set(aspect * 1.1, 1.8);
          uniforms.uAspect.value = aspect;
        },
        update(frame) {
          const p = props.current;
          const dt = Math.min(frame.dt, 1 / 20);
          time += dt * p.speed;
          uniforms.uTime.value = time;
          uniforms.uAmplitude.value = p.amplitude;
          uniforms.uReach.value = p.reach;
          uniforms.uDensity.value = p.density;
          uniforms.uDrift.value = p.drift;
          uniforms.uFade.value = p.fade ? 1 : 0;

          const key = `${p.color}|${p.highlight}|${p.background}`;
          if (key !== lastColors) {
            lastColors = key;
            // Kept as written, since this shader draws colours straight to the screen
            uniforms.uColor.value.setStyle(p.color, THREE.NoColorSpace);
            uniforms.uHighlight.value.setStyle(p.highlight, THREE.NoColorSpace);
            uniforms.uBackground.value.setStyle(p.background, THREE.NoColorSpace);
            renderer.setClearColor(p.background);
          }

          // The pointer in the scene's units: the height is 1, centred
          const bus = getSensorBus().state;
          const x = bus.pointer.x - (place.current.left - bus.scroll.x);
          const y = bus.pointer.y - (place.current.top - bus.scroll.y);
          const inside = bus.pointer.seen && x >= 0 && x <= frame.width && y >= 0 && y <= frame.height;
          const aspect = frame.width / Math.max(1, frame.height);
          const px = (x / frame.width - 0.5) * aspect;
          const py = 0.5 - y / frame.height;
          const target = uniforms.uPointer.value;
          const mx = px;
          const my = py;
          if (inside) {
            if (!placed) {
              target.set(mx, my);
              placed = true;
            }
            const k = 1 - Math.exp(-dt * FOLLOW);
            target.x += (mx - target.x) * k;
            target.y += (my - target.y) * k;
          }
          swellTarget = inside ? p.swell : 0;
          uniforms.uSwell.value += (swellTarget - uniforms.uSwell.value) * (1 - Math.exp(-dt * FADE));
        },
      };
    },
  });

  return (
    <div
      ref={rootRef}
      className={`vv-wavy-grid ${className}`}
      data-live={mounted ? "" : undefined}
      style={
        {
          "--vv-wg-color": color,
          "--vv-wg-bg": background,
          "--vv-wg-cell": `calc(100% / ${density})`,
          ...style,
        } as React.CSSProperties
      }
    >
      <style>{STYLES}</style>
      <div ref={ref} className="vv-wg-scene" aria-hidden="true" />
      {children}
    </div>
  );
}

export default WavyGrid;

const STYLES = `
/* Zero specificity, so a class that sizes the component wins. */
:where(.vv-wavy-grid) { position: relative; min-height: 100svh; }
/* A still grid until the scene is drawn, and in its place under reduced motion. */
.vv-wavy-grid {
  isolation: isolate; overflow: hidden; background-color: var(--vv-wg-bg);
  background-image:
    linear-gradient(color-mix(in srgb, var(--vv-wg-color) 45%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--vv-wg-color) 45%, transparent) 1px, transparent 1px);
  background-size: var(--vv-wg-cell) var(--vv-wg-cell);
  background-position: center;
}
.vv-wavy-grid::after {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 20%, var(--vv-wg-bg) 62%);
}
.vv-wavy-grid[data-live]::after { display: none; }
.vv-wg-scene { position: absolute; inset: 0; z-index: -1; }
`;
