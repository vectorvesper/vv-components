"use client";

import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

const colorCache: Record<string, { r: number; g: number; b: number }> = {};

function colorToRgb(color: string): { r: number; g: number; b: number } {
  if (colorCache[color]) return colorCache[color];

  if (color.startsWith("#")) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = color.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    const parsed = result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 126, g: 172, b: 181 };
    colorCache[color] = parsed;
    return parsed;
  }

  if (typeof document !== "undefined") {
    try {
      const temp = document.createElement("div");
      temp.style.color = color;
      document.body.appendChild(temp);
      const computedColor = window.getComputedStyle(temp).color;
      document.body.removeChild(temp);
      const matches = computedColor.match(/\d+/g);
      if (matches && matches.length >= 3) {
        const parsed = { r: parseInt(matches[0]), g: parseInt(matches[1]), b: parseInt(matches[2]) };
        colorCache[color] = parsed;
        return parsed;
      }
    } catch {
      // Fallback
    }
  }

  return { r: 126, g: 172, b: 181 };
}

function getMasterGradient(
  ctx: CanvasRenderingContext2D,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  colors: string[],
  direction: string,
  width: number,
  height: number
): CanvasGradient {
  const minX = bbox.minX === Infinity ? 0 : bbox.minX;
  const maxX = bbox.maxX === -Infinity ? width : bbox.maxX;
  const minY = bbox.minY === Infinity ? 0 : bbox.minY;
  const maxY = bbox.maxY === -Infinity ? height : bbox.maxY;

  let grad: CanvasGradient;
  if (direction === "horizontal") {
    grad = ctx.createLinearGradient(minX, 0, maxX, 0);
  } else if (direction === "vertical") {
    grad = ctx.createLinearGradient(0, minY, 0, maxY);
  } else {
    grad = ctx.createLinearGradient(minX, minY, maxX, maxY);
  }

  colors.forEach((col, idx) => {
    grad.addColorStop(idx / (colors.length - 1), col);
  });
  return grad;
}

function drawParticleShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vx: number,
  vy: number,
  size: number,
  shape: string,
  tail: number
) {
  const sp = Math.sqrt(vx * vx + vy * vy);
  const len = sp * tail;

  if (tail > 0 && len > 0.6 && shape === "circle") {
    ctx.beginPath();
    ctx.moveTo(x - vx * tail, y - vy * tail);
    ctx.lineTo(x, y);
    ctx.stroke();
  } else {
    ctx.beginPath();
    if (shape === "circle") {
      ctx.arc(x, y, Math.max(size, 0.6), 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === "square") {
      ctx.fillRect(x - size, y - size, size * 2, size * 2);
    } else if (shape === "triangle") {
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y + size);
      ctx.lineTo(x - size, y + size);
      ctx.closePath();
      ctx.fill();
    } else if (shape === "star") {
      for (let idx = 0; idx < 5; idx++) {
        ctx.lineTo(
          x + Math.cos(((18 + idx * 72) * Math.PI) / 180) * size,
          y - Math.sin(((18 + idx * 72) * Math.PI) / 180) * size
        );
        ctx.lineTo(
          x + Math.cos(((54 + idx * 72) * Math.PI) / 180) * (size / 2),
          y - Math.sin(((54 + idx * 72) * Math.PI) / 180) * (size / 2)
        );
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}

export interface DispersedTextProps {
  /** The word, phrase, or short sentence the particles assemble into (required). */
  text: string;
  /** Explicit font size in pixels. If provided, disables dynamic fitWidth calculation. */
  fontSize?: number;
  /** Particle color — any CSS color string (default: "#7EACB5"). */
  color?: string;
  /** Pixel sampling step — smaller = denser text + more particles (default: 6). */
  gap?: number;
  /** Font weight used when sampling the text (default: 700). */
  fontWeight?: number | string;
  /** Font family used when sampling the text (default: bold system-ui stack). */
  fontFamily?: string;
  /** Fraction of the canvas width the text should span, 0–1 (default: 0.82). */
  fitWidth?: number;
  /** Line-height multiplier when the text wraps onto multiple lines (default: 1.15). */
  lineHeight?: number;
  /** Home-pull strength — how fast particles assemble and reform (default: 0.08). */
  spring?: number;
  /** How fast the word melts/gathers on interaction, per frame 0–1 (default: 0.06). */
  meltSpeed?: number;
  /** Cursor physics force multiplier while the word is dissolved (default: 1.2). */
  swirl?: number;
  /** Cursor vortex/influence radius in px (default: 160). */
  swirlRadius?: number;
  /** Comet tail length while moving — 0 = round dots (default: 5). */
  streak?: number;
  /** Streak thickness / base dot size in px (default: 1.7). */
  dotSize?: number;
  /** Flow turbulence of the scattered particles (default: 1). */
  turbulence?: number;
  /** Cap the device pixel ratio for performance (default: 2). */
  maxDpr?: number;
  /** Paint an fps + particle-count readout onto the canvas (default: false). */
  debug?: boolean;
  /** Extra classes for the canvas element. */
  className?: string;
  /** Inline style overrides for the canvas element. */
  style?: React.CSSProperties;
  /** Accessible label (defaults to `text`). */
  "aria-label"?: string;

  // --- PREMIUM UPGRADES ---
  /** Interaction mode of the dispersed particle field (default: "flow"). */
  interactionMode?: "flow" | "explode" | "attract" | "vortex" | "wind" | "gravity";
  /** Coloring model of the particles (default: "solid"). */
  colorMode?: "solid" | "gradient" | "speed";
  /** Array of colors used when colorMode is "gradient" (default: ["#7EACB5", "#E07B9B"]). */
  gradientColors?: string[];
  /** Direction of the linear gradient (default: "horizontal"). */
  gradientDirection?: "horizontal" | "vertical" | "diagonal";
  /** Highlight color particles morph to when moving at high speeds in speed mode (default: "#FF007A"). */
  speedColor?: string;
  /** Geometric particle shape (default: "circle"). */
  shape?: "circle" | "square" | "triangle" | "star";
  /** Add a neon glow effect to the canvas using GPU CSS filter (default: false). */
  glow?: boolean;
  /** Color of the neon glow (default: value of color prop). */
  glowColor?: string;
  /** Blur radius of the neon glow (default: 8). */
  glowBlur?: number;
  /** Action trigger for dispersion (default: "hover"). */
  trigger?: "hover" | "click" | "manual";
  /** Force dispersion when trigger is "manual" (default: false). */
  isDispersed?: boolean;
  /** Control dispersion progress continuously (0 to 1) when trigger is "manual" (default: 0). */
  progress?: number;
  /** Blow direction angle in radians (default: 0, blowing right) - only for wind mode. */
  windAngle?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number;
  hy: number;
  size: number;
  alpha: number;
  scale: number;
  isDying: boolean;
}

export default function DispersedText({
  text,
  fontSize,
  color = "#7EACB5",
  gap = 6,
  fontWeight = 700,
  fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fitWidth = 0.82,
  lineHeight = 1.15,
  spring = 0.08,
  meltSpeed = 0.06,
  swirl = 1.2,
  swirlRadius = 160,
  streak = 5,
  dotSize = 1.7,
  turbulence = 1,
  maxDpr = 2,
  debug = false,
  className = "",
  style,
  "aria-label": ariaLabel,

  // Premium features
  interactionMode = "flow",
  colorMode = "solid",
  gradientColors = ["#7EACB5", "#E07B9B"],
  gradientDirection = "horizontal",
  speedColor = "#FF007A",
  shape = "circle",
  glow = false,
  glowColor,
  glowBlur = 8,
  trigger = "hover",
  isDispersed = false,
  progress = 0,
  windAngle = 0,
}: DispersedTextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  const textRef = useRef(text);
  const colorRef = useRef(color);
  const colorModeRef = useRef(colorMode);
  const gradientColorsRef = useRef(gradientColors);
  const gradientDirectionRef = useRef(gradientDirection);
  const speedColorRef = useRef(speedColor);
  const interactionModeRef = useRef(interactionMode);
  const shapeRef = useRef(shape);
  const triggerRef = useRef(trigger);
  const isDispersedRef = useRef(isDispersed);
  const progressRef = useRef(progress);
  const windAngleRef = useRef(windAngle);
  const dotSizeRef = useRef(dotSize);
  const streakRef = useRef(streak);
  const springRef = useRef(spring);
  const meltSpeedRef = useRef(meltSpeed);
  const swirlRef = useRef(swirl);
  const swirlRadiusRef = useRef(swirlRadius);
  const turbulenceRef = useRef(turbulence);

  React.useEffect(() => {
    textRef.current = text;
    colorRef.current = color;
    colorModeRef.current = colorMode;
    gradientColorsRef.current = gradientColors;
    gradientDirectionRef.current = gradientDirection;
    speedColorRef.current = speedColor;
    interactionModeRef.current = interactionMode;
    shapeRef.current = shape;
    triggerRef.current = trigger;
    isDispersedRef.current = isDispersed;
    progressRef.current = progress;
    windAngleRef.current = windAngle;
    dotSizeRef.current = dotSize;
    streakRef.current = streak;
    springRef.current = spring;
    meltSpeedRef.current = meltSpeed;
    swirlRef.current = swirl;
    swirlRadiusRef.current = swirlRadius;
    turbulenceRef.current = turbulence;
  }, [
    text,
    color,
    colorMode,
    gradientColors,
    gradientDirection,
    speedColor,
    interactionMode,
    shape,
    trigger,
    isDispersed,
    progress,
    windAngle,
    dotSize,
    streak,
    spring,
    meltSpeed,
    swirl,
    swirlRadius,
    turbulence,
  ]);

  const particlesRef = useRef<Particle[]>([]);
  const bboxRef = useRef({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  const canvasInitializedRef = useRef(false);
  const triggerResampleRef = useRef<() => void>(() => {});
  const clickDispersedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    const reduce = !!reduceMotion;
    let width = 0;
    let height = 0;

    const setSize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, Math.max(1, maxDpr));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const sampleTargets = (): { x: number; y: number }[] => {
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.floor(width));
      off.height = Math.max(1, Math.floor(height));
      const octx = off.getContext("2d");
      if (!octx) return [];

      const words = textRef.current.split(/\s+/).filter(Boolean);
      const maxW = off.width * fitWidth;
      const maxH = off.height * 0.72;
      const lh = Math.max(1, lineHeight);

      const wrapAt = (fontSize: number): string[] => {
        octx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const lines: string[] = [];
        let cur = "";
        for (const w of words) {
          const test = cur ? `${cur} ${w}` : w;
          if (!cur || octx.measureText(test).width <= maxW) {
            cur = test;
          } else {
            lines.push(cur);
            cur = w;
          }
        }
        if (cur) lines.push(cur);
        return lines.length ? lines : [textRef.current];
      };

      let best = fontSize;
      let bestLines: string[] = [textRef.current];
      if (!best) {
        let lo = 8;
        let hi = Math.max(8, Math.floor(off.height * 0.9));
        best = 8;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const lines = wrapAt(mid);
          octx.font = `${fontWeight} ${mid}px ${fontFamily}`;
          let widest = 0;
          for (const ln of lines) widest = Math.max(widest, octx.measureText(ln).width);
          if (widest <= maxW && lines.length * mid * lh <= maxH) {
            best = mid;
            bestLines = lines;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
      } else {
        bestLines = wrapAt(best);
      }

      octx.font = `${fontWeight} ${best}px ${fontFamily}`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillStyle = "#fff";
      const lineStep = best * lh;
      const startY = off.height / 2 - ((bestLines.length - 1) * lineStep) / 2;
      bestLines.forEach((ln, i) => octx.fillText(ln, off.width / 2, startY + i * lineStep));

      const data = octx.getImageData(0, 0, off.width, off.height).data;
      const step = Math.max(2, Math.floor(gap));
      const pts: { x: number; y: number }[] = [];
      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          if (data[(y * off.width + x) * 4 + 3] > 128) pts.push({ x, y });
        }
      }
      return pts;
    };

    const pointer = { x: -9999, y: -9999, active: false };

    const morphParticles = (newTargets: { x: number; y: number }[]) => {
      const current = particlesRef.current;
      const active = current.filter((p) => !p.isDying);

      active.sort((a, b) => a.hx - b.hx);
      const sortedTargets = [...newTargets].sort((a, b) => a.x - b.x);

      const M = active.length;
      const T = sortedTargets.length;
      const nextParts: Particle[] = [];

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pt of sortedTargets) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
      if (sortedTargets.length) {
        bboxRef.current = { minX, minY, maxX, maxY };
      }

      const minLen = Math.min(M, T);
      for (let i = 0; i < minLen; i++) {
        const p = active[i];
        p.hx = sortedTargets[i].x;
        p.hy = sortedTargets[i].y;
        p.isDying = false;
        nextParts.push(p);
      }

      if (T > M) {
        const spawnX = pointer.active ? pointer.x : width / 2;
        const spawnY = pointer.active ? pointer.y : height / 2;
        for (let i = M; i < T; i++) {
          nextParts.push({
            x: spawnX + (Math.random() - 0.5) * 30,
            y: spawnY + (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            hx: sortedTargets[i].x,
            hy: sortedTargets[i].y,
            size: Math.max(dotSizeRef.current / 2, 0.6) + Math.random() * (dotSizeRef.current / 2),
            alpha: 0,
            scale: 0,
            isDying: false,
          });
        }
      }

      if (M > T) {
        for (let i = T; i < M; i++) {
          const p = active[i];
          p.isDying = true;
          nextParts.push(p);
        }
      }

      for (const p of current) {
        if (p.isDying && !nextParts.includes(p)) {
          nextParts.push(p);
        }
      }

      particlesRef.current = nextParts;
    };

    const triggerResample = () => {
      const pts = sampleTargets();
      morphParticles(pts);
    };
    triggerResampleRef.current = triggerResample;

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      if (colorModeRef.current === "gradient") {
        ctx.fillStyle = getMasterGradient(
          ctx,
          bboxRef.current,
          gradientColorsRef.current,
          gradientDirectionRef.current,
          width,
          height
        );
      } else {
        ctx.fillStyle = colorRef.current;
      }

      const shp = shapeRef.current;
      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];
        drawParticleShape(ctx, p.x, p.y, p.vx, p.vy, p.size, shp, 0);
      }
    };

    setSize();
    canvasInitializedRef.current = true;
    triggerResample();

    if (reduce) drawStatic();

    try {
      const fontSpec = `${fontWeight} 64px ${fontFamily}`;
      if (typeof document !== "undefined" && document.fonts && !document.fonts.check(fontSpec)) {
        document.fonts
          .load(fontSpec)
          .then(() => {
            if (!cancelled) {
              triggerResample();
              if (reduce) drawStatic();
            }
          })
          .catch(() => {});
      }
    } catch {
      // Fallback
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
      pointer.x = pointer.y = -9999;
    };
    const onClick = () => {
      if (triggerRef.current === "click") {
        clickDispersedRef.current = !clickDispersedRef.current;
      }
    };

    if (!reduce) {
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerleave", onLeave);
      canvas.addEventListener("click", onClick);
    }



    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            const pw = width;
            const ph = height;
            setSize();
            if (Math.abs(width - pw) > 2 || Math.abs(height - ph) > 2) {
              triggerResample();
              if (reduce) drawStatic();
            }
          })
        : null;
    ro?.observe(canvas);

    if (reduce) {
      return () => {
        cancelled = true;
        ro?.disconnect();
      };
    }

    const tail = Math.max(0, streakRef.current);
    ctx.lineCap = "round";

    const flowAngle = (x: number, y: number, t: number) => {
      const freq = 0.0045 * Math.max(0.1, turbulenceRef.current);
      return (
        (Math.sin(x * freq + t * 0.0003) +
          Math.cos(y * freq * 1.1 - t * 0.00025) +
          Math.sin((x + y) * freq * 0.62 + t * 0.0002)) *
        1.4
      );
    };

    let raf = 0;
    let last = performance.now();
    let fps = 60;
    let dispersion = 0;
    const t0 = last;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = now - t0;
      const dt = now - last;
      last = now;
      if (dt > 0) fps = fps * 0.9 + (1000 / dt) * 0.1;

      let targetDispersion = 0;
      const trig = triggerRef.current;
      const bbox = bboxRef.current;

      if (trig === "hover") {
        const pad = 40;
        const over =
          pointer.active &&
          pointer.x >= bbox.minX - pad &&
          pointer.x <= bbox.maxX + pad &&
          pointer.y >= bbox.minY - pad &&
          pointer.y <= bbox.maxY + pad;
        targetDispersion = over ? 1 : 0;
      } else if (trig === "click") {
        targetDispersion = clickDispersedRef.current ? 1 : 0;
      } else if (trig === "manual") {
        targetDispersion = progressRef.current !== undefined ? progressRef.current : (isDispersedRef.current ? 1 : 0);
      }

      const ease = Math.min(1, Math.max(0.005, meltSpeedRef.current));
      dispersion += (targetDispersion - dispersion) * ease;

      ctx.clearRect(0, 0, width, height);

      if (colorModeRef.current === "gradient") {
        const grad = getMasterGradient(
          ctx,
          bbox,
          gradientColorsRef.current,
          gradientDirectionRef.current,
          width,
          height
        );
        ctx.fillStyle = grad;
        ctx.strokeStyle = grad;
      } else if (colorModeRef.current === "solid") {
        ctx.fillStyle = colorRef.current;
        ctx.strokeStyle = colorRef.current;
      }

      const c1 = colorModeRef.current === "speed" ? colorToRgb(colorRef.current) : null;
      const c2 = colorModeRef.current === "speed" ? colorToRgb(speedColorRef.current) : null;

      const parts = particlesRef.current;
      const swirlRad = swirlRadiusRef.current;
      const swirlVal = swirlRef.current;
      const springVal = springRef.current;
      const shp = shapeRef.current;
      const mode = interactionModeRef.current;

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];

        if (p.isDying) {
          p.scale -= 0.05;
          p.alpha -= 0.05;
          if (p.scale <= 0 || p.alpha <= 0) {
            parts.splice(i, 1);
            i--;
            continue;
          }
        } else {
          if (p.scale < 1) p.scale += 0.05;
          if (p.alpha < 1) p.alpha += 0.05;
          p.scale = Math.min(1, p.scale);
          p.alpha = Math.min(1, p.alpha);
        }

        let ax = (p.hx - p.x) * springVal * (1 - dispersion);
        let ay = (p.hy - p.y) * springVal * (1 - dispersion);

        if (dispersion > 0.002) {
          if (mode === "flow") {
            const ang = flowAngle(p.x, p.y, t);
            ax += Math.cos(ang) * 0.16 * dispersion;
            ay += Math.sin(ang) * 0.16 * dispersion;

            if (pointer.active) {
              const dx = p.x - pointer.x;
              const dy = p.y - pointer.y;
              const dd = Math.sqrt(dx * dx + dy * dy) || 1;
              if (dd < swirlRad) {
                const f = (1 - dd / swirlRad) * swirlVal * dispersion;
                ax += (-dy / dd) * f + (-dx / dd) * f * 0.28;
                ay += (dx / dd) * f + (-dy / dd) * f * 0.28;
              }
            }
          } else if (mode === "explode") {
            if (pointer.active) {
              const dx = p.x - pointer.x;
              const dy = p.y - pointer.y;
              const dd = Math.sqrt(dx * dx + dy * dy) || 1;
              if (dd < swirlRad) {
                const force = (1 - dd / swirlRad) * swirlVal * 4.5 * dispersion;
                ax += (dx / dd) * force;
                ay += (dy / dd) * force;
              }
            } else {
              const ang = flowAngle(p.x, p.y, t);
              ax += Math.cos(ang) * 0.08 * dispersion;
              ay += Math.sin(ang) * 0.08 * dispersion;
            }
          } else if (mode === "attract") {
            if (pointer.active) {
              const dx = pointer.x - p.x;
              const dy = pointer.y - p.y;
              const dd = Math.sqrt(dx * dx + dy * dy) || 1;
              if (dd < swirlRad) {
                const force = (1 - dd / swirlRad) * swirlVal * 1.5 * dispersion;
                ax += (dx / dd) * force;
                ay += (dy / dd) * force;
              }
            } else {
              const ang = flowAngle(p.x, p.y, t);
              ax += Math.cos(ang) * 0.08 * dispersion;
              ay += Math.sin(ang) * 0.08 * dispersion;
            }
          } else if (mode === "vortex") {
            if (pointer.active) {
              const dx = p.x - pointer.x;
              const dy = p.y - pointer.y;
              const dd = Math.sqrt(dx * dx + dy * dy) || 1;
              if (dd < swirlRad) {
                const f = (1 - dd / swirlRad) * swirlVal * 2.5 * dispersion;
                const pull = f * 0.22;
                ax += (-dy / dd) * f - (dx / dd) * pull;
                ay += (dx / dd) * f - (dy / dd) * pull;
              }
            } else {
              const cx = width / 2;
              const cy = height / 2;
              const dx = p.x - cx;
              const dy = p.y - cy;
              const dd = Math.sqrt(dx * dx + dy * dy) || 1;
              const f = 0.5 * dispersion;
              ax += (-dy / dd) * f - (dx / dd) * f * 0.1;
              ay += (dx / dd) * f - (dy / dd) * f * 0.1;
            }
          } else if (mode === "wind") {
            const angle = windAngleRef.current;
            const speed = 0.35 * Math.max(0.1, turbulenceRef.current);
            ax += Math.cos(angle) * speed * dispersion;
            ay += Math.sin(angle) * speed * dispersion;

            const noise = flowAngle(p.x, p.y, t);
            ax += Math.cos(noise) * 0.1 * dispersion;
            ay += Math.sin(noise) * 0.1 * dispersion;
          } else if (mode === "gravity") {
            ay += 0.32 * dispersion;
            const ang = flowAngle(p.x, p.y, t);
            ax += Math.cos(ang) * 0.05 * dispersion;
          }
        }

        const friction = 0.82 - (1.0 - dispersion) * 0.08;
        p.vx = (p.vx + ax) * friction;
        p.vy = (p.vy + ay) * friction;
        p.x += p.vx;
        p.y += p.vy;

        if (mode === "gravity" && dispersion > 0.05) {
          const floor = height - 6;
          if (p.y >= floor) {
            p.y = floor;
            p.vy = -Math.abs(p.vy) * 0.45;
            p.vx *= 0.75;
          }
        }

        const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        ctx.globalAlpha = p.alpha * Math.max(0.35, 1 - sp * 0.05 * dispersion);

        if (c1 && c2) {
          const r = Math.min(1, sp / 5);
          const r_val = Math.round(c1.r + (c2.r - c1.r) * r);
          const g_val = Math.round(c1.g + (c2.g - c1.g) * r);
          const b_val = Math.round(c1.b + (c2.b - c1.b) * r);
          const colorStr = `rgb(${r_val}, ${g_val}, ${b_val})`;
          ctx.fillStyle = colorStr;
          ctx.strokeStyle = colorStr;
        }

        const size = p.size * p.scale * (dotSizeRef.current / 1.7);
        drawParticleShape(ctx, p.x, p.y, p.vx, p.vy, size, shp, tail);
      }
      ctx.globalAlpha = 1;

      if (debug) {
        ctx.fillStyle = colorModeRef.current === "speed" ? speedColorRef.current : colorRef.current;
        ctx.globalAlpha = 0.9;
        ctx.font = "12px monospace";
        ctx.fillText(`${Math.round(fps)} fps · ${parts.length} particles`, 10, 18);
        ctx.globalAlpha = 1;
      }
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, [
    fontWeight,
    fontFamily,
    fitWidth,
    lineHeight,
    gap,
    maxDpr,
    debug,
    reduceMotion,
    fontSize,
  ]);

  useEffect(() => {
    if (!canvasInitializedRef.current) return;
    triggerResampleRef.current();
  }, [text, gap, fontWeight, fontFamily, fitWidth, lineHeight, fontSize]);

  const glowFilter = glow
    ? `drop-shadow(0 0 ${glowBlur}px ${glowColor || color})`
    : undefined;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        filter: glowFilter,
        ...style,
      }}
      role="img"
      aria-label={ariaLabel ?? text}
    />
  );
}
