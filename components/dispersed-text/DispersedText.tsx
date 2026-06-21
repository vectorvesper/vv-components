"use client";

import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

// The brand accent "#7EACB5" is the default particle color — find-and-replace to re-theme.

export interface DispersedTextProps {
  /** The word, phrase, or short sentence the particles assemble into (required). */
  text: string;
  /** Particle color — any CSS color string. Set it to contrast with your surface (default: "#7EACB5"). */
  color?: string;
  /** Pixel sampling step — smaller = denser text + more particles (default: 6). */
  gap?: number;
  /** Font weight used when sampling the text (default: 700). */
  fontWeight?: number | string;
  /** Font family used when sampling the text — pass your own to match your type (default: a bold sans stack). */
  fontFamily?: string;
  /** Fraction of the canvas width the text should span, 0–1 (default: 0.82). */
  fitWidth?: number;
  /** Line-height multiplier when the text wraps onto multiple lines (default: 1.15). */
  lineHeight?: number;
  /** Home-pull strength — how fast particles assemble and reform (default: 0.08). */
  spring?: number;
  /** How fast the word melts on hover and reforms on leave, per frame 0–1 (default: 0.06). */
  meltSpeed?: number;
  /** Cursor vortex strength while the word is dissolved (default: 1.2). */
  swirl?: number;
  /** Cursor vortex radius in px (default: 160). */
  swirlRadius?: number;
  /** Comet tail length while moving — 0 = round dots (default: 5). */
  streak?: number;
  /** Streak thickness / dot size in px (default: 1.7). */
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
  /** Accessible label (defaults to `text`, since the canvas renders real words). */
  "aria-label"?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number;
  hy: number;
}

/**
 * DispersedText — the `text` is sampled into a cloud of particles that stream in
 * from the left and assemble into the word. Hovering over the word melts the whole
 * thing into a flowing, cursor-swirled field; it reforms into the letters the moment
 * the cursor leaves. Renders to a single transparent <canvas> that fills its parent,
 * so give the parent a size and set `color` to contrast with whatever's behind it.
 */
export default function DispersedText({
  text,
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
}: DispersedTextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

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

      const words = text.split(/\s+/).filter(Boolean);
      const maxW = off.width * fitWidth;
      const maxH = off.height * 0.72;
      const lh = Math.max(1, lineHeight);

      // Greedily wrap the words into lines that fit `maxW` at a given font size.
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
        return lines.length ? lines : [text];
      };

      // Binary-search the largest font size whose wrapped block fits width + height.
      let lo = 8;
      let hi = Math.max(8, Math.floor(off.height * 0.9));
      let best = 8;
      let bestLines: string[] = [text];
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

    let parts: Particle[] = [];
    const bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const build = () => {
      const pts = sampleTargets();
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const pt of pts) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
      if (pts.length) {
        bbox.minX = minX;
        bbox.minY = minY;
        bbox.maxX = maxX;
        bbox.maxY = maxY;
      }
      parts = pts.map((pt) =>
        reduce
          ? { x: pt.x, y: pt.y, vx: 0, vy: 0, hx: pt.x, hy: pt.y }
          : {
              x: -Math.random() * width * 0.4 - 20,
              y: pt.y + (Math.random() - 0.5) * 40,
              vx: 0,
              vy: 0,
              hx: pt.x,
              hy: pt.y,
            }
      );
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      for (let i = 0; i < parts.length; i++) {
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(parts[i].x, parts[i].y, Math.max(dotSize / 2, 1), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    setSize();
    build();
    if (reduce) drawStatic();

    // Custom web fonts may not be loaded when we first sample. If the requested
    // font isn't ready, re-sample once it loads so the letterforms are correct.
    try {
      const fontSpec = `${fontWeight} 64px ${fontFamily}`;
      if (typeof document !== "undefined" && document.fonts && !document.fonts.check(fontSpec)) {
        document.fonts
          .load(fontSpec)
          .then(() => {
            if (!cancelled) {
              build();
              if (reduce) drawStatic();
            }
          })
          .catch(() => {});
      }
    } catch {
      /* Font Loading API unavailable — sample with whatever is ready. */
    }

    const pointer = { x: -9999, y: -9999, active: false };
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
    if (!reduce) {
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerleave", onLeave);
    }

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            const pw = width;
            const ph = height;
            setSize();
            if (Math.abs(width - pw) > 2 || Math.abs(height - ph) > 2) {
              build();
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

    const freq = 0.0045 * Math.max(0.1, turbulence);
    const tail = Math.max(0, streak);
    const ease = Math.min(1, Math.max(0.005, meltSpeed));
    ctx.lineCap = "round";

    const flowAngle = (x: number, y: number, t: number) =>
      (Math.sin(x * freq + t * 0.0003) +
        Math.cos(y * freq * 1.1 - t * 0.00025) +
        Math.sin((x + y) * freq * 0.62 + t * 0.0002)) *
      1.4;

    const drawParticle = (p: Particle, alpha: number) => {
      ctx.globalAlpha = alpha;
      // A near-stationary particle has a zero-length streak, which browsers skip
      // entirely — that made the formed word vanish at rest. Fall back to a dot
      // whenever the streak would be too short to render reliably.
      const len = Math.sqrt(p.vx * p.vx + p.vy * p.vy) * tail;
      if (tail > 0 && len > 0.6) {
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * tail, p.y - p.vy * tail);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(dotSize / 2, 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    let raf = 0;
    let last = performance.now();
    let fps = 60;
    let dispersion = 0; // 0 = formed word, 1 = fully melted into the flow field
    const t0 = last;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = now - t0;
      const dt = now - last;
      last = now;
      if (dt > 0) fps = fps * 0.9 + (1000 / dt) * 0.1;

      // Is the cursor over the word's box? Ease the whole field toward scattered.
      const pad = 40;
      const over =
        pointer.active &&
        pointer.x >= bbox.minX - pad &&
        pointer.x <= bbox.maxX + pad &&
        pointer.y >= bbox.minY - pad &&
        pointer.y <= bbox.maxY + pad;
      dispersion += ((over ? 1 : 0) - dispersion) * ease;

      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = dotSize;

      const d = dispersion;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        let ax = (p.hx - p.x) * spring * (1 - d);
        let ay = (p.hy - p.y) * spring * (1 - d);

        if (d > 0.002) {
          const ang = flowAngle(p.x, p.y, t);
          ax += Math.cos(ang) * 0.16 * d;
          ay += Math.sin(ang) * 0.16 * d;
          if (pointer.active) {
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            const dd = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dd < swirlRadius) {
              const f = (1 - dd / swirlRadius) * swirl * d;
              ax += (-dy / dd) * f + (-dx / dd) * f * 0.28;
              ay += (dx / dd) * f + (-dy / dd) * f * 0.28;
            }
          }
        }

        p.vx = (p.vx + ax) * 0.82;
        p.vy = (p.vy + ay) * 0.82;
        p.x += p.vx;
        p.y += p.vy;

        const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        drawParticle(p, Math.max(0.35, 0.9 - sp * 0.05));
      }
      ctx.globalAlpha = 1;

      if (debug) {
        ctx.fillStyle = color;
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
    };
  }, [
    text,
    color,
    gap,
    fontWeight,
    fontFamily,
    fitWidth,
    lineHeight,
    spring,
    meltSpeed,
    swirl,
    swirlRadius,
    streak,
    dotSize,
    turbulence,
    maxDpr,
    debug,
    reduceMotion,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
      role="img"
      aria-label={ariaLabel ?? text}
    />
  );
}
