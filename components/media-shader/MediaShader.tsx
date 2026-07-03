"use client";

import React, { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

// ─── 1. TYPES ────────────────────────────────────────────────────────

/** A media element the scene can texture. */
export type MediaElement = HTMLImageElement | HTMLVideoElement;

/**
 * The preset contract every media-shader effect ships against.
 * A preset is a fragment shader + its taste defaults; the scene owns the
 * vertex stage, the uniform plumbing, and cover-fit.
 */
export interface MediaShaderPreset {
  name: string;
  fragment: string;
  defaults: {
    intensity: number;
    noiseScale: number;
    idle: number;
    pointerDamp?: number;
    hoverDamp?: number;
  };
}

export interface MediaShaderOptions {
  /** Built-in preset name or a custom preset object. */
  preset?: string | MediaShaderPreset;
  /** Overall effect strength multiplier. Default from the preset. */
  intensity?: number;
  /** Spatial frequency of the effect's field. Default from the preset. */
  noiseScale?: number;
  /** 0..1 resting motion when not hovered. Default from the preset. */
  idle?: number;
  /**
   * Free-form preset parameters, exposed to the shader as `u_params` (vec4).
   * How each slot is interpreted is the preset's business — this is the
   * extension slot custom presets use for modes and extra knobs.
   */
  params?: readonly number[];
}

/**
 * What a register call hands back. `active: false` means the scene chose
 * not to run (SSR, no WebGL2, reduced motion) and the element was left
 * untouched — the fail-open path.
 */
export interface MediaShaderHandle {
  active: boolean;
  setOptions(options: MediaShaderOptions): void;
  destroy(): void;
}

// ─── 2. CONDUCTOR (rAF Loop Manager) ──────────────────────────────────

type ConductorLane = "input" | "update" | "render";
type FrameFn = (dt: number, time: number) => void;

const LANE_ORDER: ConductorLane[] = ["input", "update", "render"];
const MAX_DT = 0.1; // seconds; anything longer is a tab-sleep artifact

class FrameConductor {
  private subs: Record<ConductorLane, Set<FrameFn>> = {
    input: new Set(),
    update: new Set(),
    render: new Set(),
  };
  private rafId: number | null = null;
  private last = 0;
  private time = 0;

  subscribe(lane: ConductorLane, fn: FrameFn): () => void {
    this.subs[lane].add(fn);
    this.start();
    let alive = true;
    return () => {
      if (!alive) return;
      alive = false;
      this.subs[lane].delete(fn);
      if (this.subscriberCount() === 0) this.stop();
    };
  }

  private subscriberCount(): number {
    return LANE_ORDER.reduce((n, lane) => n + this.subs[lane].size, 0);
  }

  private start(): void {
    if (this.rafId !== null) return;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (this.rafId === null) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private tick = (now: number): void => {
    this.rafId = requestAnimationFrame(this.tick);
    const dt = Math.min((now - this.last) / 1000, MAX_DT);
    this.last = now;
    this.time += dt;
    for (const lane of LANE_ORDER) {
      for (const fn of [...this.subs[lane]]) fn(dt, this.time);
    }
  };
}

let conductorInstance: FrameConductor | null = null;

function getConductor(): FrameConductor {
  if (conductorInstance === null) conductorInstance = new FrameConductor();
  return conductorInstance;
}

// ─── 3. WEBGL HELPERS ────────────────────────────────────────────────

function createGL(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  return canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
  });
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("vv-motion: could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`vv-motion: shader compile failed:\n${log}`);
  }
  return shader;
}

interface ProgramInfo {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSrc: string,
  fragmentSrc: string,
  uniformNames: string[],
): ProgramInfo {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();
  if (!program) throw new Error("vv-motion: could not create program");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`vv-motion: program link failed:\n${log}`);
  }
  const uniforms: ProgramInfo["uniforms"] = {};
  for (const name of uniformNames) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

function createMediaTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("vv-motion: could not create texture");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}

function uploadMediaTexture(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  source: TexImageSource,
): void {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
}

function createUnitQuad(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("vv-motion: could not create VAO");
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}

// ─── 4. SHADER PRESETS ───────────────────────────────────────────────

// A. liquid-chromatic: Premium liquid chromatic ripple preset
export const liquidChromaticPreset: MediaShaderPreset = {
  name: "liquid-chromatic",
  fragment: `#version 300 es
    precision highp float;

    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_hover;
    uniform vec2  u_pointer;
    uniform float u_intensity;
    uniform float u_noiseScale;
    uniform float u_idle;
    uniform vec4  u_cover;
    uniform vec4  u_rect;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = rand(i);
      float b = rand(i + vec2(1.0, 0.0));
      float c = rand(i + vec2(0.0, 1.0));
      float d = rand(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
      vec2 uv = vUv;
      vec2 st = uv * u_cover.xy + u_cover.zw;
      vec2 pointerUv = u_pointer;
      float dist = length(uv - pointerUv);
      float ripple = sin(dist * 16.0 - u_time * 3.2) * 0.5 + 0.5;
      float strength = smoothstep(0.45 * u_noiseScale, 0.0, dist) * u_hover;
      vec2 noiseOffset = vec2(
        noise(uv * 10.0 + u_time * 0.5),
        noise(uv * 10.0 - u_time * 0.5 + 2.0)
      ) * 0.02 * u_idle;
      vec2 disp = normalize(uv - pointerUv + 0.001) * ripple * strength * 0.04 * u_intensity + noiseOffset;
      vec3 col;
      col.r = texture(u_tex, st - disp * 1.6).r;
      col.g = texture(u_tex, st - disp * 1.0).g;
      col.b = texture(u_tex, st - disp * 0.4).b;
      float lighting = 1.0 - length(disp) * 0.7;
      col *= lighting;
      outColor = vec4(col, 1.0);
    }
  `,
  defaults: {
    intensity: 1.0,
    noiseScale: 1.0,
    idle: 0.5,
  }
};

// B. curl-distortion: Liquid displacement blooming around the cursor
export const curlDistortionPreset: MediaShaderPreset = {
  name: "curl-distortion",
  fragment: `#version 300 es
    precision highp float;

    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_hover;
    uniform vec2  u_pointer;
    uniform float u_intensity;
    uniform float u_noiseScale;
    uniform float u_idle;
    uniform vec4  u_cover;

    float hash(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 34.5);
      return fract(p.x * p.y);
    }

    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i),                 hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p *= 2.03;
        a *= 0.5;
      }
      return v;
    }

    vec2 curl(vec2 p) {
      float e = 0.12;
      float nY1 = fbm(p + vec2(0.0, e));
      float nY2 = fbm(p - vec2(0.0, e));
      float nX1 = fbm(p + vec2(e, 0.0));
      float nX2 = fbm(p - vec2(e, 0.0));
      return vec2(nY1 - nY2, -(nX1 - nX2)) / (2.0 * e);
    }

    void main() {
      vec2 uv = vUv;
      float bloom = 1.0 - smoothstep(0.0, 0.55, distance(uv, u_pointer));
      float drive = u_idle * 0.3 + u_hover * (0.25 + 0.75 * bloom);
      vec2 edge = smoothstep(0.0, 0.12, uv) * smoothstep(0.0, 0.12, 1.0 - uv);
      float amt = u_intensity * drive * edge.x * edge.y;
      vec2 flow = curl(uv * u_noiseScale + vec2(0.0, u_time * 0.18));
      vec2 disp = flow * amt * 0.065;
      vec2 st = (uv + disp) * u_cover.xy + u_cover.zw;
      vec2 caShift = disp * 0.4 * u_cover.xy;
      vec3 col;
      col.r = texture(u_tex, st + caShift).r;
      col.g = texture(u_tex, st).g;
      col.b = texture(u_tex, st - caShift).b;
      outColor = vec4(col, 1.0);
    }
  `,
  defaults: {
    intensity: 1.0,
    noiseScale: 3.2,
    idle: 0.14,
  },
};

// C. focus-loupe: Circular region of sharp focus on blur/desaturated media
export const focusLoupePreset: MediaShaderPreset = {
  name: "focus-loupe",
  fragment: `#version 300 es
    precision highp float;

    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D u_tex;
    uniform float u_time;
    uniform float u_hover;
    uniform vec2  u_pointer;
    uniform float u_intensity;
    uniform float u_noiseScale;
    uniform float u_idle;
    uniform vec4  u_cover;
    uniform vec4  u_rect;

    void main() {
      vec2 uv = vUv;
      vec2 st = uv * u_cover.xy + u_cover.zw;
      vec2 localPx = uv * u_rect.zw;
      vec2 pointerPx = u_pointer * u_rect.zw;
      float distPx = length(localPx - pointerPx);
      float radius = min(u_rect.z, u_rect.w) * 0.10 * u_noiseScale;
      radius *= 1.0 + 0.03 * sin(u_time * 1.6) * u_idle;

      vec2 texel = (u_cover.xy / u_rect.zw) * (2.4 * u_intensity);
      vec3 blurC = vec3(0.0);
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          blurC += texture(u_tex, st + vec2(float(x), float(y)) * texel).rgb;
        }
      }
      blurC /= 9.0;
      float lumaB = dot(blurC, vec3(0.299, 0.587, 0.114));
      vec3 muted = mix(vec3(lumaB), blurC, 0.3) * 0.9;

      float inside = (1.0 - smoothstep(radius - 16.0, radius + 2.0, distPx)) * u_hover;
      float rim = smoothstep(radius + 8.0, radius - 4.0, distPx)
                * smoothstep(radius - 30.0, radius - 12.0, distPx) * u_hover;
      vec2 dir = (localPx - pointerPx) / max(distPx, 1.0);
      vec2 pull = dir * rim * 0.008 * u_cover.xy;
      vec3 sharp;
      sharp.r = texture(u_tex, st - pull * 1.25).r;
      sharp.g = texture(u_tex, st - pull).g;
      sharp.b = texture(u_tex, st - pull * 0.75).b;
      sharp *= 1.0 + inside * 0.05;

      vec3 col = mix(muted, sharp, inside);
      col += rim * 0.09;
      outColor = vec4(col, 1.0);
    }
  `,
  defaults: {
    intensity: 1.0,
    noiseScale: 3.0,
    idle: 0.5,
  },
};

export const PRESETS = {
  "liquid-chromatic": liquidChromaticPreset,
  "curl-distortion": curlDistortionPreset,
  "focus-loupe": focusLoupePreset,
} as const;

export type PresetName = keyof typeof PRESETS;

export function resolvePreset(
  input: string | MediaShaderPreset | undefined,
): MediaShaderPreset {
  if (input === undefined) return liquidChromaticPreset;
  if (typeof input !== "string") return input;
  const preset = (PRESETS as Record<string, MediaShaderPreset>)[input];
  if (!preset) {
    console.warn(`vv-motion: unknown preset "${input}", using liquid-chromatic.`);
    return liquidChromaticPreset;
  }
  return preset;
}

// ─── 5. SCENE ENGINE ─────────────────────────────────────────────────

const VERTEX_SRC = /* glsl */ `#version 300 es
layout(location = 0) in vec2 a_pos;
uniform vec4 u_rect;
uniform vec2 u_view;
out vec2 vUv;
void main() {
  vUv = a_pos;
  vec2 px = u_rect.xy + a_pos * u_rect.zw;
  vec2 clip = vec2(px.x / u_view.x * 2.0 - 1.0, 1.0 - px.y / u_view.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

const UNIFORM_NAMES = [
  "u_rect", "u_view", "u_tex", "u_time", "u_hover", "u_pointer",
  "u_intensity", "u_noiseScale", "u_idle", "u_cover", "u_dpr", "u_params",
];

type ParamsVec4 = [number, number, number, number];

function toParams(input: readonly number[] | undefined): ParamsVec4 {
  return [input?.[0] ?? 0, input?.[1] ?? 0, input?.[2] ?? 0, input?.[3] ?? 0];
}

const CULL_MARGIN = 120;
const MAX_DPR = 2;
let resolutionScale = 1;

export function setMediaShaderResolution(scale: number): void {
  resolutionScale = Math.min(Math.max(scale, 0.2), 1);
}

function damp(current: number, target: number, k: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-k * dt));
}

interface Plane {
  el: MediaElement;
  isVideo: boolean;
  tex: WebGLTexture;
  ready: boolean;
  naturalW: number;
  naturalH: number;
  preset: MediaShaderPreset;
  intensity: number;
  noiseScale: number;
  idle: number;
  params: ParamsVec4;
  hover: number;
  hoverTarget: number;
  pointerX: number;
  pointerY: number;
  pointerTargetX: number;
  pointerTargetY: number;
  lastRect: DOMRect;
  prevOpacity: string;
  cleanup: Array<() => void>;
}

class MediaShaderScene {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private quad: WebGLVertexArrayObject;
  private programs = new Map<string, ProgramInfo>();
  private planes: Plane[] = [];
  private unsubscribe: () => void;
  private contextLost = false;

  constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    this.quad = createUnitQuad(gl);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.unsubscribe = getConductor().subscribe("render", this.render);
  }

  add(el: MediaElement, options: MediaShaderOptions): MediaShaderHandle {
    const preset = resolvePreset(options.preset);
    this.ensureProgram(preset);

    const plane: Plane = {
      el,
      isVideo: el instanceof HTMLVideoElement,
      tex: createMediaTexture(this.gl),
      ready: false,
      naturalW: 0,
      naturalH: 0,
      preset,
      intensity: options.intensity ?? preset.defaults.intensity,
      noiseScale: options.noiseScale ?? preset.defaults.noiseScale,
      idle: options.idle ?? preset.defaults.idle,
      params: toParams(options.params),
      hover: 0,
      hoverTarget: 0,
      pointerX: 0.5,
      pointerY: 0.5,
      pointerTargetX: 0.5,
      pointerTargetY: 0.5,
      lastRect: el.getBoundingClientRect(),
      prevOpacity: el.style.opacity,
      cleanup: [],
    };

    this.prepareTexture(plane);
    this.attachPointer(plane);

    el.style.opacity = "0";
    this.planes.push(plane);

    return {
      active: true,
      setOptions: (next: MediaShaderOptions) => {
        if (next.intensity !== undefined) plane.intensity = next.intensity;
        if (next.noiseScale !== undefined) plane.noiseScale = next.noiseScale;
        if (next.idle !== undefined) plane.idle = next.idle;
        if (next.params !== undefined) plane.params = toParams(next.params);
        if (next.preset !== undefined) {
          const resolved = resolvePreset(next.preset);
          if (resolved.name !== plane.preset.name) {
            plane.preset = resolved;
            this.ensureProgram(resolved);
          }
        }
      },
      destroy: () => this.remove(plane),
    };
  }

  private remove(plane: Plane): void {
    const i = this.planes.indexOf(plane);
    if (i === -1) return;
    this.planes.splice(i, 1);
    for (const fn of plane.cleanup) fn();
    plane.el.style.opacity = plane.prevOpacity;
    this.gl.deleteTexture(plane.tex);
    if (this.planes.length === 0) this.teardown();
  }

  private teardown(): void {
    this.unsubscribe();
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.canvas.remove();
    sceneInstance = null;
  }

  private prepareTexture(plane: Plane): void {
    if (plane.isVideo) return;
    const img = plane.el as HTMLImageElement;
    const upload = () => {
      if (img.naturalWidth === 0) return;
      plane.naturalW = img.naturalWidth;
      plane.naturalH = img.naturalHeight;
      uploadMediaTexture(this.gl, plane.tex, img);
      plane.ready = true;
    };
    if (img.complete && img.naturalWidth > 0) {
      upload();
    } else {
      const onLoad = () => upload();
      img.addEventListener("load", onLoad);
      plane.cleanup.push(() => img.removeEventListener("load", onLoad));
    }
  }

  private attachPointer(plane: Plane): void {
    const el: HTMLElement = plane.el;
    const enter = () => { plane.hoverTarget = 1; };
    const leave = () => { plane.hoverTarget = 0; };
    const move = (e: PointerEvent) => {
      const r = plane.lastRect;
      if (r.width === 0 || r.height === 0) return;
      plane.pointerTargetX = (e.clientX - r.left) / r.width;
      plane.pointerTargetY = (e.clientY - r.top) / r.height;
    };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointermove", move);
    plane.cleanup.push(() => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointermove", move);
    });
  }

  private ensureProgram(preset: MediaShaderPreset): void {
    if (this.programs.has(preset.name)) return;
    this.programs.set(
      preset.name,
      createProgram(this.gl, VERTEX_SRC, preset.fragment, UNIFORM_NAMES),
    );
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    for (const plane of this.planes) plane.el.style.opacity = plane.prevOpacity;
    console.warn("vv-motion: WebGL context lost — showing plain media until restored.");
  };

  private onContextRestored = (): void => {
    this.programs.clear();
    this.quad = createUnitQuad(this.gl);
    for (const plane of this.planes) {
      this.ensureProgram(plane.preset);
      plane.tex = createMediaTexture(this.gl);
      plane.ready = false;
      this.prepareTexture(plane);
      plane.el.style.opacity = "0";
    }
    this.contextLost = false;
  };

  private render = (dt: number, time: number): void => {
    if (this.contextLost) return;
    const gl = this.gl;

    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    if (vw === 0 || vh === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) * resolutionScale;
    const bw = Math.round(vw * dpr);
    const bh = Math.round(vh * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }

    gl.viewport(0, 0, bw, bh);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindVertexArray(this.quad);

    for (const plane of this.planes) {
      const rect = plane.el.getBoundingClientRect();
      plane.lastRect = rect;

      const hoverK = plane.preset.defaults.hoverDamp ?? 10;
      const pointerK = plane.preset.defaults.pointerDamp ?? 12;
      plane.hover = damp(plane.hover, plane.hoverTarget, hoverK, dt);
      plane.pointerX = damp(plane.pointerX, plane.pointerTargetX, pointerK, dt);
      plane.pointerY = damp(plane.pointerY, plane.pointerTargetY, pointerK, dt);

      if (!plane.ready && plane.isVideo) {
        const video = plane.el as HTMLVideoElement;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          plane.naturalW = video.videoWidth;
          plane.naturalH = video.videoHeight;
          plane.ready = true;
        }
      }
      if (!plane.ready) continue;

      const offscreen =
        rect.bottom < -CULL_MARGIN || rect.top > vh + CULL_MARGIN ||
        rect.right < -CULL_MARGIN || rect.left > vw + CULL_MARGIN;
      if (offscreen || rect.width === 0 || rect.height === 0) continue;

      if (plane.isVideo) {
        uploadMediaTexture(gl, plane.tex, plane.el as HTMLVideoElement);
      }

      const info = this.programs.get(plane.preset.name);
      if (!info) continue;
      gl.useProgram(info.program);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, plane.tex);
      gl.uniform1i(info.uniforms.u_tex, 0);

      const scale = Math.max(rect.width / plane.naturalW, rect.height / plane.naturalH);
      const sx = rect.width / (plane.naturalW * scale);
      const sy = rect.height / (plane.naturalH * scale);
      gl.uniform4f(info.uniforms.u_cover, sx, sy, (1 - sx) / 2, (1 - sy) / 2);

      gl.uniform4f(info.uniforms.u_rect, rect.left, rect.top, rect.width, rect.height);
      gl.uniform2f(info.uniforms.u_view, vw, vh);
      gl.uniform1f(info.uniforms.u_time, time);
      gl.uniform1f(info.uniforms.u_hover, plane.hover);
      gl.uniform2f(info.uniforms.u_pointer, plane.pointerX, plane.pointerY);
      gl.uniform1f(info.uniforms.u_intensity, plane.intensity);
      gl.uniform1f(info.uniforms.u_noiseScale, plane.noiseScale);
      gl.uniform1f(info.uniforms.u_idle, plane.idle);
      gl.uniform1f(info.uniforms.u_dpr, dpr);
      gl.uniform4f(
        info.uniforms.u_params,
        plane.params[0], plane.params[1], plane.params[2], plane.params[3],
      );

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.bindVertexArray(null);
  };
}

let sceneInstance: MediaShaderScene | null = null;

const INACTIVE_HANDLE: MediaShaderHandle = {
  active: false,
  setOptions: () => {},
  destroy: () => {},
};

function createScene(): MediaShaderScene | null {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;";
  document.body.appendChild(canvas);
  const gl = createGL(canvas);
  if (!gl) {
    canvas.remove();
    return null;
  }
  return new MediaShaderScene(canvas, gl);
}

export function registerMediaShader(
  el: MediaElement,
  options: MediaShaderOptions = {},
): MediaShaderHandle {
  if (typeof window === "undefined") return INACTIVE_HANDLE;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return INACTIVE_HANDLE;
  }
  if (sceneInstance === null) {
    sceneInstance = createScene();
    if (sceneInstance === null) return INACTIVE_HANDLE;
  }
  try {
    return sceneInstance.add(el, options);
  } catch (err) {
    console.error("vv-motion: media shader failed to initialize:", err);
    return INACTIVE_HANDLE;
  }
}

// ─── 6. REACT COMPONENT ───────────────────────────────────────────────

export interface ShaderImageProps
  extends ComponentPropsWithoutRef<"img"> {
  /** Built-in preset name or a custom preset object. */
  preset?: PresetName | MediaShaderPreset;
  /** Strength multiplier. */
  intensity?: number;
  /** Spatial frequency of the effect's field. */
  noiseScale?: number;
  /** 0..1 resting motion when not hovered. */
  idle?: number;
  /** Free-form parameters. */
  params?: readonly number[];
}

export function ShaderImage({
  preset,
  intensity,
  noiseScale,
  idle,
  params,
  alt = "",
  ...imgProps
}: ShaderImageProps) {
  const ref = useRef<HTMLImageElement>(null);
  const handleRef = useRef<MediaShaderHandle | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = registerMediaShader(el, { preset, intensity, noiseScale, idle, params });
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
    // Only run on mount/unmount — dynamic option changes handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setOptions({ intensity, noiseScale, idle, preset, params });
  }, [intensity, noiseScale, idle, preset, params]);

  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt={alt} crossOrigin="anonymous" {...imgProps} />;
}

// ─── 7. SHADER VIDEO COMPONENT ────────────────────────────────────────

export interface ShaderVideoProps
  extends ComponentPropsWithoutRef<"video"> {
  /** Built-in preset name or a custom preset object. */
  preset?: PresetName | MediaShaderPreset;
  /** Strength multiplier. */
  intensity?: number;
  /** Spatial frequency of the effect's field. */
  noiseScale?: number;
  /** 0..1 resting motion when not hovered. */
  idle?: number;
  /** Free-form parameters. */
  params?: readonly number[];
}

export function ShaderVideo({
  preset,
  intensity,
  noiseScale,
  idle,
  params,
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  ...videoProps
}: ShaderVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<MediaShaderHandle | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = registerMediaShader(el, { preset, intensity, noiseScale, idle, params });
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setOptions({ intensity, noiseScale, idle, preset, params });
  }, [intensity, noiseScale, idle, preset, params]);

  return (
    <video
      ref={ref}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline={playsInline}
      crossOrigin="anonymous"
      {...videoProps}
    />
  );
}
