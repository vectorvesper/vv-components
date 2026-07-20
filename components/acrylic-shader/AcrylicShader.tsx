"use client";

import React, { useEffect, useRef, useState } from "react";

/** A named color palette (RGB values normalized 0.0–1.0). */
export interface AcrylicShaderPalette {
  label: string;
  color1: [number, number, number];
  color2: [number, number, number];
  color3: [number, number, number];
  color4: [number, number, number];
}

export type AcrylicShaderPreset = "aurora" | "emerald" | "crimson" | "frost";

/**
 * Built-in palettes. Pass one via the `preset` prop, or import this to build a
 * palette picker (each entry has a human `label` + the four gradient colors).
 */
export const ACRYLIC_SHADER_PRESETS: Record<AcrylicShaderPreset, AcrylicShaderPalette> = {
  aurora: {
    label: "Midnight Aurora",
    color1: [0.02, 0.01, 0.08],
    color2: [0.32, 0.04, 0.65],
    color3: [0.0, 0.85, 0.95],
    color4: [0.95, 0.15, 0.65],
  },
  emerald: {
    label: "Jade Forest",
    color1: [0.01, 0.03, 0.02],
    color2: [0.05, 0.45, 0.22],
    color3: [0.0, 0.85, 0.45],
    color4: [0.85, 0.75, 0.15],
  },
  crimson: {
    label: "Crimson Nova",
    color1: [0.03, 0.0, 0.01],
    color2: [0.55, 0.05, 0.08],
    color3: [0.95, 0.25, 0.15],
    color4: [0.85, 0.65, 0.05],
  },
  frost: {
    label: "Frost Wave",
    color1: [0.04, 0.05, 0.08],
    color2: [0.15, 0.35, 0.65],
    color3: [0.0, 0.75, 0.95],
    color4: [0.85, 0.85, 0.92],
  },
};

export interface AcrylicShaderProps {
  /** Named color palette. Individual `colorN` props override it. Default: "crimson". */
  preset?: AcrylicShaderPreset;
  /** Gradient colors (RGB normalized 0.0–1.0). Each overrides the preset's palette. */
  color1?: [number, number, number];
  color2?: [number, number, number];
  color3?: [number, number, number];
  color4?: [number, number, number];
  /** Animation speed multiplier. Default: 1.2 */
  speed?: number;
  /** Pointer warp sensitivity. Default: 0.05 */
  sensitivity?: number;
  /** Density of the fluid ripples — higher = more micro-folds. Default: 3.0 */
  density?: number;
  /** Vignette shadow strength (0.0–1.0). Default: 0.6 */
  vignetteStrength?: number;
  /** Swirl distortion around the pointer. Default: 2.0 */
  swirlStrength?: number;
  /** Radial push distortion around the pointer. Default: 0.08 */
  pushStrength?: number;
  /** Background wave flow rate. Default: 0.9 */
  flowStrength?: number;
  /** Canvas transparency (0.0–1.0). Default: 1.0 */
  opacity?: number;
  /** Extra className merged onto the root element (e.g. to override positioning). */
  className?: string;
}

/**
 * AcrylicShader — a self-contained WebGL fluid-gradient background.
 *
 * Fills its nearest positioned parent (`position: absolute; inset: 0`) and reacts
 * to pointer + touch with a soft swirl/push warp. Zero dependencies, no Tailwind
 * required. Degrades gracefully: a static CSS gradient where WebGL is unavailable
 * or the user prefers reduced motion.
 *
 *   <div style={{ position: "relative", height: "100vh" }}>
 *     <AcrylicShader preset="aurora" />
 *   </div>
 */
export default function AcrylicShader({
  preset = "crimson",
  color1,
  color2,
  color3,
  color4,
  speed = 1.2,
  sensitivity = 0.05,
  density = 3.0,
  vignetteStrength = 0.6,
  swirlStrength = 2.0,
  pushStrength = 0.08,
  flowStrength = 0.9,
  opacity = 1.0,
  className,
}: AcrylicShaderProps): React.JSX.Element {
  const palette = ACRYLIC_SHADER_PRESETS[preset] ?? ACRYLIC_SHADER_PRESETS.crimson;
  const c1 = color1 ?? palette.color1;
  const c2 = color2 ?? palette.color2;
  const c3 = color3 ?? palette.color3;
  const c4 = color4 ?? palette.color4;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglSupported, setWebglSupported] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Live params in a ref so prop changes never re-init the GL context.
  const paramsRef = useRef({
    color1: c1, color2: c2, color3: c3, color4: c4,
    speed, sensitivity, density, vignetteStrength, swirlStrength, pushStrength, flowStrength,
  });
  useEffect(() => {
    paramsRef.current = {
      color1: c1, color2: c2, color3: c3, color4: c4,
      speed, sensitivity, density, vignetteStrength, swirlStrength, pushStrength, flowStrength,
    };
  }, [c1, c2, c3, c4, speed, sensitivity, density, vignetteStrength, swirlStrength, pushStrength, flowStrength]);

  const pointerRef = useRef({ x: 0, y: 0, lx: 0, ly: 0, speed: 0 });
  const timeRef = useRef(0);

  // Honor the user's reduced-motion preference (updates live if it changes).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return; // a static gradient is rendered instead
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Production optimizations: disable unneeded buffers.
    const gl = canvas.getContext("webgl", {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      setWebglSupported(false);
      return;
    }

    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_mouse_speed;
      uniform float u_time;
      uniform float u_speed;
      uniform float u_sensitivity;

      uniform float u_density;
      uniform float u_vignette;
      uniform float u_swirl;
      uniform float u_push;
      uniform float u_flow;

      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform vec3 u_color3;
      uniform vec3 u_color4;

      float noise(in vec2 p) {
        return sin(p.x * 0.5) * sin(p.y * 0.5) + 0.2 * sin(p.x * 1.7 + p.y * 1.3);
      }

      mat2 rotate(float angle) {
        return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
      }

      float fbm(in vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p * frequency);
          p = rotate(0.5) * p * 2.0 + vec2(0.0, u_time * u_speed * u_flow * 0.04);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

        vec2 m = (u_mouse - 0.5 * u_resolution) / u_resolution.y;

        float m_dist = length(p - m);
        float push_force = exp(-m_dist * 4.5);
        vec2 swirl_dir = vec2(-(p.y - m.y), p.x - m.x);

        float speed_factor = 0.15 + u_mouse_speed * 2.5 * u_sensitivity;
        p += swirl_dir * push_force * u_swirl * speed_factor;
        p += (p - m) * push_force * u_push * speed_factor;

        p *= u_density;

        vec2 q = vec2(
          fbm(p * 2.0 + vec2(0.0, 0.0)),
          fbm(p * 2.0 + vec2(5.2, 1.3))
        );

        vec2 r = vec2(
          fbm(p * 2.0 + 4.0 * q + vec2(1.7, 9.2) + u_time * u_speed * 0.15),
          fbm(p * 2.0 + 4.0 * q + vec2(8.3, 2.8) + u_time * u_speed * 0.126)
        );

        float f = fbm(p * 1.8 + 4.0 * r);

        vec3 color = mix(u_color1, u_color2, clamp(f * f * 4.0, 0.0, 1.0));
        color = mix(color, u_color3, clamp(length(q), 0.0, 1.0) * 0.4);
        color = mix(color, u_color4, clamp(r.x * r.x * 2.0, 0.0, 1.0) * 0.35);

        float vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
        float vig = clamp(pow(16.0 * vignette, 0.22), 0.0, 1.0);
        color = mix(color, color * vig, u_vignette);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uMouse = gl.getUniformLocation(program, "u_mouse");
    const uMouseSpeed = gl.getUniformLocation(program, "u_mouse_speed");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uSpeed = gl.getUniformLocation(program, "u_speed");
    const uSensitivity = gl.getUniformLocation(program, "u_sensitivity");

    const uDensity = gl.getUniformLocation(program, "u_density");
    const uVignette = gl.getUniformLocation(program, "u_vignette");
    const uSwirl = gl.getUniformLocation(program, "u_swirl");
    const uPush = gl.getUniformLocation(program, "u_push");
    const uFlow = gl.getUniformLocation(program, "u_flow");

    const uColor1 = gl.getUniformLocation(program, "u_color1");
    const uColor2 = gl.getUniformLocation(program, "u_color2");
    const uColor3 = gl.getUniformLocation(program, "u_color3");
    const uColor4 = gl.getUniformLocation(program, "u_color4");

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2.0 to save GPU on hi-dpi
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resizeCanvas();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pointer = pointerRef.current;
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const pointer = pointerRef.current;
      pointer.x = e.touches[0].clientX - rect.left;
      pointer.y = e.touches[0].clientY - rect.top;
    };

    const handlePointerReset = () => {
      const pointer = pointerRef.current;
      pointer.x = window.innerWidth / 2;
      pointer.y = window.innerHeight / 2;
    };

    pointerRef.current.x = window.innerWidth / 2;
    pointerRef.current.y = window.innerHeight / 2;
    pointerRef.current.lx = window.innerWidth / 2;
    pointerRef.current.ly = window.innerHeight / 2;

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("mouseleave", handlePointerReset, { passive: true });
    document.addEventListener("touchend", handlePointerReset, { passive: true });

    let animationFrameId = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      const p = paramsRef.current;
      timeRef.current += dt;

      const pointer = pointerRef.current;
      const dx = pointer.x - pointer.lx;
      const dy = pointer.y - pointer.ly;

      // Interpolate position with inertia.
      pointer.lx += dx * 0.08;
      pointer.ly += dy * 0.08;

      // Silky-smooth speed: base it on visual trailing distance.
      const trailingDistance = Math.sqrt(dx * dx + dy * dy);
      const targetSpeed = Math.min(2.0, trailingDistance * 0.012);

      // Decay or rise speed with a dynamic spring/friction lerp.
      pointer.speed += (targetSpeed - pointer.speed) * 0.12;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uMouse, pointer.lx * dpr, canvas.height - pointer.ly * dpr);
      gl.uniform1f(uMouseSpeed, pointer.speed);
      gl.uniform1f(uTime, timeRef.current);
      gl.uniform1f(uSpeed, p.speed);
      gl.uniform1f(uSensitivity, p.sensitivity);

      gl.uniform1f(uDensity, p.density);
      gl.uniform1f(uVignette, p.vignetteStrength);
      gl.uniform1f(uSwirl, p.swirlStrength);
      gl.uniform1f(uPush, p.pushStrength);
      gl.uniform1f(uFlow, p.flowStrength);

      gl.uniform3fv(uColor1, p.color1);
      gl.uniform3fv(uColor2, p.color2);
      gl.uniform3fv(uColor3, p.color3);
      gl.uniform3fv(uColor4, p.color4);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("mouseleave", handlePointerReset);
      document.removeEventListener("touchend", handlePointerReset);
      cancelAnimationFrame(animationFrameId);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [reducedMotion]);

  // Fallback: a static gradient (reduced motion, or no WebGL). Still on-brand.
  if (reducedMotion || !webglSupported) {
    const toCss = (c: [number, number, number]) =>
      `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
    return (
      <div
        aria-hidden="true"
        className={className}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: `linear-gradient(135deg, ${toCss(c1)}, ${toCss(c2)}, ${toCss(c3)}, ${toCss(c4)})`,
          opacity,
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
        userSelect: "none",
        opacity,
        transition: "opacity 0.5s ease",
      }}
    />
  );
}
