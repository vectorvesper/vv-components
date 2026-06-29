"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export type JellyButtonProps = {
  /** Label text or React element */
  children: React.ReactNode;
  /** Predefined style preset: 'jelly' | 'viscous' */
  variant?: "jelly" | "viscous";
  /** Width of the button body in pixels (default: 200) */
  width?: number;
  /** Height of the button body in pixels (default: 56) */
  height?: number;
  /** Corner radius of the rounded-rect blob (default: 14) */
  radius?: number;
  /** Range of mouse proximity tracking (default: 130) */
  range?: number;
  /** Core color of the jelly blob (default: '#8B5CF6' violet) */
  buttonColor?: string;
  /** Color flashed on click (default: '#FFFFFF') */
  clickColor?: string;
  /** Disable interaction (no animation, dimmed) */
  disabled?: boolean;
  /** Native button type (default: 'button') */
  type?: "button" | "submit" | "reset";
  /** Accessible label, useful when children are icon-only */
  "aria-label"?: string;
  /** Click action callback */
  onClick?: () => void;
  /** Custom CSS classes */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Maximum stretch distance pull on mouse hover (default: 26) */
  maxStretch?: number;
  /** Ripple force velocity magnitude injected on click (default: 35) */
  rippleForce?: number;
};

interface JellyPoint {
  x: number;       // current X
  y: number;       // current Y
  vx?: number;      // velocity X
  vy?: number;      // velocity Y
  restX: number;   // resting anchor X
  restY: number;   // resting anchor Y
  targetX: number; // target coordinate X
  targetY: number; // target coordinate Y
  angle: number;   // outward angle from center
}

interface JellyPreset {
  buttonColor?: string;
  stiffness?: number;
  damping?: number;
  maxStretch?: number;
  rippleForce?: number;
}

const PRESETS: Record<"jelly" | "viscous", JellyPreset> = {
  jelly: { buttonColor: "#8B5CF6", stiffness: 0.12, damping: 0.82, maxStretch: 26, rippleForce: 35 },
  viscous: { buttonColor: "#10B981", stiffness: 0.04, damping: 0.94, maxStretch: 45, rippleForce: 20 },
};

export default function JellyButton({
  children,
  variant = "jelly",
  width = 200,
  height = 56,
  radius,
  range = 130,
  buttonColor,
  clickColor = "#FFFFFF",
  disabled = false,
  type = "button",
  "aria-label": ariaLabel,
  onClick,
  className = "",
  style = {},
  maxStretch,
  rippleForce,
}: JellyButtonProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const textRef = useRef<HTMLButtonElement>(null);

  const preset = PRESETS[variant] || PRESETS.jelly;
  const resolvedButtonColor = buttonColor ?? preset.buttonColor ?? "#8B5CF6";
  const resolvedMaxStretch = maxStretch ?? preset.maxStretch ?? 26;
  const resolvedRippleForce = rippleForce ?? preset.rippleForce ?? 35;

  // Background flash + a short window where the click ripple takes priority
  // over hover deformation (otherwise the next mousemove overwrites the ripple).
  const [currentBgColor, setCurrentBgColor] = useState(resolvedButtonColor);
  const rippleTimeRef = useRef(0);

  useEffect(() => {
    setCurrentBgColor(resolvedButtonColor);
  }, [resolvedButtonColor]);

  let resolvedEase = "elastic.out(1.0, 0.4)";
  let resolvedDuration = 0.8;
  if (variant === "viscous") {
    resolvedEase = "elastic.out(0.65, 0.35)";
    resolvedDuration = 1.6;
  }

  const padX = 60, padY = 40;
  const svgW = width + padX * 2;
  const svgH = height + padY * 2;
  const pointsRef = useRef<JellyPoint[]>([]);

  const drawPath = () => {
    const pts = pointsRef.current;
    if (pts.length === 0) return;
    const mids = pts.map((p, i) => ({
      x: (p.x + pts[(i + 1) % pts.length].x) / 2,
      y: (p.y + pts[(i + 1) % pts.length].y) / 2
    }));

    let d = `M ${mids[0].x.toFixed(2)},${mids[0].y.toFixed(2)}`;
    pts.forEach((_, i) => {
      const next = pts[(i + 1) % pts.length], mid = mids[(i + 1) % mids.length];
      d += ` Q ${next.x.toFixed(2)},${next.y.toFixed(2)} ${mid.x.toFixed(2)},${mid.y.toFixed(2)}`;
    });
    d += " Z";

    if (pathRef.current) pathRef.current.setAttribute("d", d);
  };

  useEffect(() => {
    drawPath();
  }, [width, height]);

  const mouseInProximity = useRef(false);

  const { contextSafe } = useGSAP({ scope: containerRef });

  useGSAP(() => {
    const container = containerRef.current;
    if (!container) return;

    const cx = padX + width / 2;
    const cy = padY + height / 2;
    const r = Math.min(radius ?? 14, width / 4, height / 4);

    const list: JellyPoint[] = [];
    const boundaryPoints = [
      { rx: cx - width / 2 + 2 * r, ry: cy - height / 2 },
      { rx: cx + width / 2 - 2 * r, ry: cy - height / 2 },
      { rx: cx + width / 2, ry: cy - height / 2 },
      { rx: cx + width / 2, ry: cy - height / 2 + 2 * r },
      { rx: cx + width / 2, ry: cy + height / 2 - 2 * r },
      { rx: cx + width / 2, ry: cy + height / 2 },
      { rx: cx + width / 2 - 2 * r, ry: cy + height / 2 },
      { rx: cx - width / 2 + 2 * r, ry: cy + height / 2 },
      { rx: cx - width / 2, ry: cy + height / 2 },
      { rx: cx - width / 2, ry: cy + height / 2 - 2 * r },
      { rx: cx - width / 2, ry: cy - height / 2 + 2 * r },
      { rx: cx - width / 2, ry: cy - height / 2 },
    ];
    boundaryPoints.forEach((bp) => {
      const angle = Math.atan2(bp.ry - cy, bp.rx - cx);
      list.push({
        x: bp.rx, y: bp.ry,
        restX: bp.rx, restY: bp.ry,
        targetX: bp.rx, targetY: bp.ry,
        angle,
      });
    });
    pointsRef.current = list;
    drawPath();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);

      const pts = pointsRef.current;
      if (pts.length === 0) return;

      if (dist < range) {
        mouseInProximity.current = true;
        const mx = dx + padX + width / 2, my = dy + padY + height / 2;
        const mDist = Math.sqrt(dx * dx + dy * dy) || 1, dirX = dx / mDist, dirY = dy / mDist;

        // Skip hover deformation briefly after a click so the ripple stays visible.
        if (performance.now() >= rippleTimeRef.current) {
          pts.forEach((p) => {
            const dot = Math.cos(p.angle) * dirX + Math.sin(p.angle) * dirY;
            const pdx = mx - p.restX, pdy = my - p.restY;
            const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
            const pull = Math.max(0, dot) * Math.max(0, 1 - pDist / range) * resolvedMaxStretch;
            const targetX = p.restX + Math.cos(p.angle) * pull;
            const targetY = p.restY + Math.sin(p.angle) * pull;

            gsap.to(p, { x: targetX, y: targetY, duration: 0.15, overwrite: "auto", onUpdate: drawPath });
          });
        }

        if (textRef.current) {
          gsap.to(textRef.current, { x: dx * 0.12, y: dy * 0.12, duration: 0.15, overwrite: "auto" });
        }
      } else {
        if (mouseInProximity.current) {
          mouseInProximity.current = false;
          handleMouseLeave();
        }
      }
    };

    const handleMouseLeave = () => {
      mouseInProximity.current = false;
      const pts = pointsRef.current;
      pts.forEach((p) => {
        gsap.to(p, { x: p.restX, y: p.restY, duration: resolvedDuration, ease: resolvedEase, overwrite: "auto", onUpdate: drawPath });
      });
      if (textRef.current) {
        gsap.to(textRef.current, { x: 0, y: 0, duration: 0.6, ease: "power2.out", overwrite: "auto" });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, { dependencies: [width, height, range, resolvedMaxStretch, radius] });

  const handlePointerClick = contextSafe(() => {
    if (disabled) return;
    const pts = pointsRef.current;
    if (pts.length === 0) return;

    // Give the ripple priority over hover deformation for its duration.
    rippleTimeRef.current = performance.now() + resolvedDuration * 700;

    pts.forEach((p, idx) => {
      const direction = idx % 2 === 0 ? 1 : -1;
      const pluckX = p.restX + Math.cos(p.angle) * direction * resolvedRippleForce;
      const pluckY = p.restY + Math.sin(p.angle) * direction * resolvedRippleForce;

      gsap.fromTo(
        p,
        { x: pluckX, y: pluckY },
        { x: p.restX, y: p.restY, duration: resolvedDuration * 1.5, ease: resolvedEase, overwrite: "auto", onUpdate: drawPath }
      );
    });

    // Flash the fill toward clickColor, then ease back.
    const colorObj = { color: clickColor };
    gsap.killTweensOf(colorObj);
    setCurrentBgColor(clickColor);
    gsap.to(colorObj, {
      color: resolvedButtonColor,
      duration: 1.0,
      ease: "power2.out",
      onUpdate: () => setCurrentBgColor(colorObj.color),
    });

    if (onClick) onClick();
  });

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center select-none overflow-visible cursor-pointer ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        ...style,
      }}
    >
      <svg
        className="absolute overflow-visible pointer-events-none drop-shadow-[0_10px_20px_rgba(139,92,246,0.25)]"
        style={{
          width: `${svgW}px`,
          height: `${svgH}px`,
          left: `-${padX}px`,
          top: `-${padY}px`,
        }}
        viewBox={`0 0 ${svgW} ${svgH}`}
      >
        <path
          ref={pathRef}
          fill={currentBgColor}
          className="transition-colors duration-300"
        />
      </svg>

      <button
        ref={textRef}
        type={type}
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={handlePointerClick}
        className="relative z-10 w-full h-full flex items-center justify-center bg-transparent border-0 p-0 font-sans font-extrabold tracking-wider text-xs transition-transform duration-300 text-white uppercase cursor-pointer pointer-events-auto outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-current disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {children}
      </button>
    </div>
  );
}
