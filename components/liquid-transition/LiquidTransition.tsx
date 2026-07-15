"use client";

import React, { useState, useEffect, useRef } from "react";

export interface PageData {
  tag: string;
  title: string;
  subtitle: string;
  bgColor: string;
  textColor: string;
}

export interface LiquidTransitionProps {
  /** The screens to page through, in order. */
  pages: PageData[];
}

type TransitionDirection = "top-to-bottom" | "left-to-right" | "bottom-to-top" | "right-to-left";

export default function LiquidTransition({ pages }: LiquidTransitionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Refs mirror state so the rAF loop never reads a stale closure value.
  const currentIndexRef = useRef(0);
  const targetIndexRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const currentDirectionRef = useRef<TransitionDirection>("top-to-bottom");
  const isMidpointSwappedRef = useRef(false);

  const animFrameId = useRef<number | null>(null);
  const startTime = useRef<number>(0);

  // One SVG path, updated by direct DOM writes for a jank-free curtain.
  const pathRef = useRef<SVGPathElement | null>(null);

  // Wheel and touch state trackers.
  const lastScrollTime = useRef(0);
  const touchStart = useRef({ x: 0, y: 0 });

  // Symmetrical timing for a single fullscreen sweep.
  const transitionDuration = 480; // curtain covers the screen
  const holdDuration = 40; // brief pause when fully covered
  const revealStartTime = transitionDuration + holdDuration; // 520ms
  const totalDuration = revealStartTime + transitionDuration; // 1040ms
  const cooldown = 1100; // guards against scroll-spam

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isTransitioningRef.current = isTransitioning;
  }, [isTransitioning]);

  // ─── Easing ─────────────────────────────────────────────────────────
  const easeInOutCubic = (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // ─── S-curve wave path string ───────────────────────────────────────
  const getPathData = (direction: TransitionDirection, elapsed: number): string => {
    const steps = 24; // points along the S-wave edge
    const points: string[] = [];

    if (elapsed < revealStartTime) {
      // ── PHASE 1: COVER ──
      const p = Math.max(0, Math.min(elapsed / transitionDuration, 1.0));
      const eased = easeInOutCubic(p);

      if (eased <= 0) return "";
      if (eased >= 1.0) {
        return "M 0 0 L 100 0 L 100 100 L 0 100 Z"; // solid cover
      }

      const bulge = Math.sin(eased * Math.PI) * 16.0;

      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const waveOffset = Math.sin(u * Math.PI * 2.0) * bulge;
        const pos = eased * 100 + waveOffset;

        if (direction === "left-to-right") {
          points.push(`${pos} ${u * 100}`);
        } else if (direction === "right-to-left") {
          points.push(`${100 - pos} ${u * 100}`);
        } else if (direction === "top-to-bottom") {
          points.push(`${u * 100} ${pos}`);
        } else {
          points.push(`${u * 100} ${100 - pos}`);
        }
      }

      if (direction === "left-to-right") {
        return `M 0 0 ${points.map((pt) => `L ${pt}`).join(" ")} L 0 100 Z`;
      } else if (direction === "right-to-left") {
        return `M 100 0 ${points.map((pt) => `L ${pt}`).join(" ")} L 100 100 Z`;
      } else if (direction === "top-to-bottom") {
        return `M 0 0 ${points.map((pt) => `L ${pt}`).join(" ")} L 100 0 Z`;
      } else {
        return `M 0 100 ${points.map((pt) => `L ${pt}`).join(" ")} L 100 100 Z`;
      }
    } else {
      // ── PHASE 2: REVEAL ──
      const p = Math.max(0, Math.min((elapsed - revealStartTime) / transitionDuration, 1.0));
      const eased = easeInOutCubic(p);

      if (eased >= 1.0) return ""; // fully revealed

      const bulge = Math.sin(eased * Math.PI) * 16.0;

      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const waveOffset = Math.sin(u * Math.PI * 2.0) * bulge;
        const pos = eased * 100 + waveOffset;

        if (direction === "left-to-right") {
          points.push(`${pos} ${u * 100}`);
        } else if (direction === "right-to-left") {
          points.push(`${100 - pos} ${u * 100}`);
        } else if (direction === "top-to-bottom") {
          points.push(`${u * 100} ${pos}`);
        } else {
          points.push(`${u * 100} ${100 - pos}`);
        }
      }

      if (direction === "left-to-right") {
        return `M 100 0 ${points.map((pt) => `L ${pt}`).join(" ")} L 100 100 Z`;
      } else if (direction === "right-to-left") {
        return `M 0 0 ${points.map((pt) => `L ${pt}`).join(" ")} L 0 100 Z`;
      } else if (direction === "top-to-bottom") {
        return `M 0 100 ${points.map((pt) => `L ${pt}`).join(" ")} L 100 100 Z`;
      } else {
        return `M 0 0 ${points.map((pt) => `L ${pt}`).join(" ")} L 100 0 Z`;
      }
    }
  };

  // ─── Animation loop ─────────────────────────────────────────────────
  const animateTransition = (timestamp: number): void => {
    if (!startTime.current) startTime.current = timestamp;
    const elapsed = timestamp - startTime.current;

    // Swap the content behind the solid curtain at the midpoint.
    if (elapsed >= revealStartTime && !isMidpointSwappedRef.current) {
      setCurrentIndex(targetIndexRef.current);
      isMidpointSwappedRef.current = true;
    }

    const pathEl = pathRef.current;
    if (pathEl) {
      const d = getPathData(currentDirectionRef.current, elapsed);
      pathEl.setAttribute("d", d);
    }

    if (elapsed < totalDuration) {
      animFrameId.current = requestAnimationFrame(animateTransition);
    } else {
      setIsTransitioning(false);
      isTransitioningRef.current = false;
      if (pathEl) pathEl.setAttribute("d", "");
    }
  };

  // ─── Navigation trigger (start + end lock) ──────────────────────────
  const triggerTransition = (forward: boolean): void => {
    const now = Date.now();
    if (isTransitioningRef.current || now - lastScrollTime.current < cooldown) return;
    lastScrollTime.current = now;

    const nextIdx = forward ? currentIndexRef.current + 1 : currentIndexRef.current - 1;

    // Boundary lock: no looping. Stay at start (0) or end (max).
    if (nextIdx < 0 || nextIdx >= pages.length) return;

    // Reduced motion: swap instantly, skip the wave sweep.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setCurrentIndex(nextIdx);
      currentIndexRef.current = nextIdx;
      return;
    }

    // Direction mapping cycles the sweep for variety across steps.
    let dir: TransitionDirection = "top-to-bottom";
    const curr = currentIndexRef.current;
    if (forward) {
      if (curr === 0) dir = "top-to-bottom";
      else if (curr === 1) dir = "left-to-right";
      else if (curr === 2) dir = "bottom-to-top";
      else dir = "top-to-bottom";
    } else {
      if (curr === 1) dir = "bottom-to-top";
      else if (curr === 2) dir = "right-to-left";
      else if (curr === 3) dir = "top-to-bottom";
      else dir = "bottom-to-top";
    }

    currentDirectionRef.current = dir;
    targetIndexRef.current = nextIdx;
    isMidpointSwappedRef.current = false;

    setIsTransitioning(true);
    isTransitioningRef.current = true;

    startTime.current = 0;
    if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    animFrameId.current = requestAnimationFrame(animateTransition);
  };

  // ─── Wheel navigation ───────────────────────────────────────────────
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 15) return;
      triggerTransition(e.deltaY > 0);
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Touch swipe navigation ─────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent): void => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent): void => {
    const deltaX = e.changedTouches[0].clientX - touchStart.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.current.y;

    const minSwipeDist = 45;
    if (Math.abs(deltaX) < minSwipeDist && Math.abs(deltaY) < minSwipeDist) return;

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      triggerTransition(deltaY < 0);
    } else {
      triggerTransition(deltaX < 0);
    }
  };

  const activePage = pages?.[currentIndex] ?? pages?.[0];
  if (!activePage) return null;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative w-full h-screen overflow-hidden select-none touch-none transition-colors duration-500"
      style={{ backgroundColor: activePage.bgColor }}
    >
      {/* ── Marketing copy ── */}
      <div
        key={currentIndex}
        className="absolute inset-0 flex flex-col items-center justify-center text-center p-6"
        style={{ color: activePage.textColor }}
      >
        <p
          className="text-[10px] font-mono tracking-[0.35em] uppercase opacity-65 mb-6 vv-lt-fade-in-up"
          style={{ animationDelay: "120ms" }}
        >
          {activePage.tag}
        </p>

        <h1
          className="text-4xl md:text-6xl font-black tracking-tight leading-[1.2] mb-8 whitespace-pre-line vv-lt-fade-in-up"
          style={{ animationDelay: "220ms" }}
        >
          {activePage.title}
        </h1>

        <p
          className="text-xs md:text-sm font-medium opacity-80 max-w-lg leading-relaxed vv-lt-fade-in-up"
          style={{ animationDelay: "320ms" }}
        >
          {activePage.subtitle}
        </p>
      </div>

      {/* ── Fullscreen S-curve wave curtain ── */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-hidden">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <path ref={pathRef} fill="#0e0e11" style={{ pointerEvents: "auto" }} d="" />
        </svg>
      </div>

      <style>{`
        .vv-lt-fade-in-up {
          opacity: 0;
          animation: vvLtFadeInUp 0.85s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes vvLtFadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vv-lt-fade-in-up { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
