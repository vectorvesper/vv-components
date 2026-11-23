"use client";

/**
 * Image Trail — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAdaptiveQuality, useSafeToMount, useSensorBus, useTick } from "@vectorvesper/motion/react";

export interface ImageTrailItem {
  src: string;
  alt?: string;
}

export interface ImageTrailProps {
  /** Images the pointer leaves behind, used in order. */
  images: (string | ImageTrailItem)[];
  /** Width of each image in px on a wide area. It shrinks on a narrow one. Default 180. */
  size?: number;
  /** Height over width. Default 1.25, a 4:5 portrait. */
  ratio?: number;
  /** Pointer travel in px between images. Default 80. */
  spacing?: number;
  /** How long each image stays, in ms. Default 1400. */
  duration?: number;
  /** Most images on screen at once. Fewer on a slow device. Default 14. */
  max?: number;
  /** Corner radius in px. Default 6. */
  radius?: number;
  /** "auto" waits for a quiet moment to start; "eager" starts at once. Default "auto". */
  mount?: "auto" | "eager";
  /** Sizes the area. Without a height it is 100svh tall. */
  className?: string;
  style?: React.CSSProperties;
  /** Content laid under the trail. */
  children?: React.ReactNode;
}

// The size holds on a wide area and shrinks toward this share of it on a narrow one
const WIDE = 1200;
const SMALLEST = 0.55;
// A fast stroke fills its gaps, up to this many images a frame
const MAX_PER_FRAME = 4;

interface Slot {
  el: HTMLImageElement;
  run: Animation | null;
}

export function ImageTrail({
  images,
  size = 180,
  ratio = 1.25,
  spacing = 80,
  duration = 1400,
  max = 14,
  radius = 6,
  mount = "auto",
  className = "",
  style,
  children,
}: ImageTrailProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const slots = useRef<Slot[]>([]);
  const bus = useSensorBus();
  const quality = useAdaptiveQuality();
  const safe = useSafeToMount({ cost: "light" });
  const ready = mount === "eager" || safe;

  const list = useMemo(
    () => images.map((i) => (typeof i === "string" ? { src: i, alt: "" } : { src: i.src, alt: i.alt ?? "" })),
    [images],
  );
  const poolSize = Math.max(1, Math.min(60, Math.floor(max)));

  // Read on each frame, so changing a prop never rebuilds the trail
  const opts = useRef({ list, size, ratio, spacing, duration });
  useEffect(() => {
    opts.current = { list, size, ratio, spacing, duration };
  });

  // Shrinks with a narrow area, so the trail keeps its proportions in a panel
  const [scale, setScale] = useState(1);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(([e]) => {
      const s = Math.min(1, Math.max(SMALLEST, e.contentRect.width / WIDE));
      setScale((prev) => (Math.abs(prev - s) > 0.01 ? s : prev));
    });
    ro.observe(root);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(root);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Decoded ahead, so an image never arrives blank
  useEffect(() => {
    if (!ready) return;
    for (const { src } of list) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }, [ready, list]);

  // A slow device keeps fewer images in the air
  const active = Math.max(1, Math.round(poolSize * (quality.tier >= 2 ? 0.5 : quality.tier === 1 ? 0.75 : 1)));
  const running = ready && visible && !quality.reducedMotion && list.length > 0;

  const trail = useRef({ inside: false, lastX: 0, lastY: 0, px: NaN, py: NaN, next: 0, image: 0, z: 1 });

  useEffect(() => {
    if (running) return;
    // Starts fresh, so coming back on screen never fires a jump from the old spot
    trail.current.inside = false;
  }, [running]);

  useEffect(
    () => () => {
      for (const s of slots.current) s.run?.cancel();
    },
    [],
  );

  const spawn = (x: number, y: number, vx: number, w: number, h: number) => {
    const t = trail.current;
    const o = opts.current;
    const slot = slots.current[t.next % active];
    t.next = (t.next + 1) % active;
    if (!slot) return;
    // The oldest image is reused when the pool is full
    slot.run?.cancel();
    const item = o.list[t.image % o.list.length];
    t.image = (t.image + 1) % o.list.length;
    const el = slot.el;
    if (el.getAttribute("src") !== item.src) el.src = item.src;
    el.style.zIndex = String(t.z++);

    // Leans the way the pointer travels
    const lean = Math.max(-10, Math.min(10, vx / 120)) + (Math.random() - 0.5) * 6;
    const drift = Math.max(-36, Math.min(36, vx * 0.03));
    const left = x - w / 2;
    const top = y - h / 2;
    const at = (dx: number, dy: number, s: number, r: number) =>
      `translate3d(${(left + dx).toFixed(1)}px, ${(top + dy).toFixed(1)}px, 0) scale(${s}) rotate(${r.toFixed(1)}deg)`;

    slot.run = el.animate(
      [
        { opacity: 0, transform: at(0, 10, 0.6, lean * 1.4), easing: "cubic-bezier(0.2, 0.9, 0.3, 1.25)" },
        { opacity: 1, transform: at(0, 0, 1, lean), offset: 0.16, easing: "cubic-bezier(0.4, 0, 0.6, 1)" },
        { opacity: 1, transform: at(drift * 0.6, 6, 0.98, lean * 0.6), offset: 0.62, easing: "cubic-bezier(0.4, 0, 1, 1)" },
        { opacity: 0, transform: at(drift, 28, 0.9, lean * 0.3) },
      ],
      { duration: o.duration, fill: "both" },
    );
  };

  useTick(
    "update",
    () => {
      const root = rootRef.current;
      const p = bus.state.pointer;
      const t = trail.current;
      if (!root || !p.seen) return;
      // Only a pointer that moved, so a scroll under a still cursor leaves nothing
      if (p.x === t.px && p.y === t.py) return;
      t.px = p.x;
      t.py = p.y;

      const r = root.getBoundingClientRect();
      const inside = p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
      if (!inside) {
        t.inside = false;
        return;
      }
      if (!t.inside) {
        // Entering sets the start, so the first image is not a jump from outside
        t.inside = true;
        t.lastX = p.x;
        t.lastY = p.y;
        return;
      }

      const o = opts.current;
      const gap = Math.max(8, o.spacing * scaleRef.current);
      const dx = p.x - t.lastX;
      const dy = p.y - t.lastY;
      const dist = Math.hypot(dx, dy);
      if (dist < gap) return;

      const w = o.size * scaleRef.current;
      const h = w * o.ratio;
      const steps = Math.floor(dist / gap);
      const n = Math.min(steps, MAX_PER_FRAME);
      // Spaced evenly along the stroke, the last at the pointer when the stroke ran long
      const ux = dx / dist;
      const uy = dy / dist;
      for (let i = 1; i <= n; i++) {
        const along = steps > MAX_PER_FRAME ? (dist * i) / n : gap * i;
        spawn(t.lastX + ux * along - r.left, t.lastY + uy * along - r.top, p.vx, w, h);
      }
      const moved = steps > MAX_PER_FRAME ? dist : gap * n;
      t.lastX += ux * moved;
      t.lastY += uy * moved;
    },
    { priority: "enhanced", enabled: running, label: "ImageTrail" },
  );

  const w = Math.round(size * scale);
  const vars = {
    "--vv-it-w": `${w}px`,
    "--vv-it-h": `${Math.round(w * ratio)}px`,
    "--vv-it-r": `${radius}px`,
  } as React.CSSProperties;

  return (
    <div ref={rootRef} className={`vv-image-trail ${className}`} style={{ ...vars, ...style }}>
      <style>{STYLES}</style>
      <div className="vv-it-content">{children}</div>
      <div className="vv-it-pool" aria-hidden="true">
        {Array.from({ length: poolSize }, (_, i) => (
          <img
            key={i}
            ref={(el) => {
              if (el) slots.current[i] = { el, run: slots.current[i]?.run ?? null };
            }}
            alt=""
            draggable={false}
            decoding="async"
          />
        ))}
      </div>
    </div>
  );
}

const STYLES = `
:where(.vv-image-trail) { position: relative; min-height: 100svh; }
.vv-image-trail { overflow: hidden; isolation: isolate; }
.vv-it-content { position: relative; z-index: 0; width: 100%; height: 100%; }
.vv-it-pool { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
.vv-it-pool img {
  position: absolute; left: 0; top: 0;
  width: var(--vv-it-w); height: var(--vv-it-h);
  object-fit: cover; border-radius: var(--vv-it-r);
  opacity: 0; user-select: none; will-change: transform, opacity;
  box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.35);
}
.vv-it-pool img:not([src]) { visibility: hidden; }
`;

export default ImageTrail;
