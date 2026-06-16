"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export type ElasticButtonProps = {
  /** Button label text */
  children: React.ReactNode;
  /** Predefined style preset: 'elastic' | 'outlined' | 'tension' */
  variant?: "elastic" | "outlined" | "tension";
  /** Width of the button body in pixels (default: 220) */
  width?: number;
  /** Height of the button body in pixels (default: 60) */
  height?: number;
  /** Proximity range to trigger elasticity in pixels (default: 140) */
  range?: number;
  /** Primary button background color */
  buttonColor?: string;
  /** Border color of the elastic string */
  borderColor?: string;
  /** Border stroke width */
  borderWidth?: number;
  /** Highlight color flashed when clicked */
  clickColor?: string;
  /** Disable interaction (no animation, dimmed) */
  disabled?: boolean;
  /** Native button type (default: 'button') */
  type?: "button" | "submit" | "reset";
  /** Accessible label, useful when children are icon-only */
  "aria-label"?: string;
  /** Action click callback */
  onClick?: () => void;
  /** Custom CSS classes */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Maximum border stretch distance on mouse proximity */
  maxStretch?: number;
  /** Pluck impulse velocity force applied on click */
  pluckForce?: number;
};

interface ControlPoint {
  x: number;      // current X in SVG space
  y: number;      // current Y in SVG space
  vx?: number;    // velocity X (optional, kept for compatibility)
  vy?: number;    // velocity Y (optional, kept for compatibility)
  restX: number;  // resting X
  restY: number;  // resting Y
  targetX: number; // target X
  targetY: number; // target Y
}

interface ElasticPreset {
  buttonColor?: string;
  borderColor?: string;
  borderWidth?: number;
  stiffness?: number;
  damping?: number;
  clickColor?: string;
  pluckForce?: number;
}

const PRESETS: Record<"elastic" | "outlined" | "tension", ElasticPreset> = {
  elastic: { buttonColor: "#FF1800", borderColor: "transparent", borderWidth: 0, stiffness: 0.12, damping: 0.78, pluckForce: 38 },
  outlined: { buttonColor: "transparent", borderColor: "#00F0FF", borderWidth: 2, clickColor: "#00F0FF", pluckForce: 50 },
  tension: { buttonColor: "#00F0FF", stiffness: 0.35, damping: 0.65, pluckForce: 60 },
};

export default function ElasticButton({
  children,
  variant = "elastic",
  width = 220,
  height = 60,
  range = 140,
  buttonColor,
  borderColor,
  borderWidth,
  clickColor = "#FFFFFF",
  disabled = false,
  type = "button",
  "aria-label": ariaLabel,
  onClick,
  className = "",
  style = {},
  maxStretch = 28,
  pluckForce,
}: ElasticButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const textRef = useRef<HTMLButtonElement>(null);

  const preset = PRESETS[variant] || PRESETS.elastic;
  const resolvedButtonColor = buttonColor ?? preset.buttonColor ?? "#FF1800";
  const resolvedBorderColor = borderColor ?? preset.borderColor ?? "transparent";
  const resolvedBorderWidth = borderWidth ?? preset.borderWidth ?? 0;
  const resolvedPluckForce = pluckForce ?? preset.pluckForce ?? 38;
  const resolvedClickColor = clickColor ?? preset.clickColor ?? "#FFFFFF";

  const padX = 60, padY = 50;
  const [currentBgColor, setCurrentBgColor] = useState(resolvedButtonColor);

  useEffect(() => {
    setCurrentBgColor(resolvedButtonColor);
  }, [resolvedButtonColor]);

  const mouseInProximity = useRef(false);
  const pointsRef = useRef<{
    top: ControlPoint; right: ControlPoint; bottom: ControlPoint; left: ControlPoint;
  }>({
    top: { x: width / 2, y: 0, restX: width / 2, restY: 0, targetX: width / 2, targetY: 0 },
    right: { x: width, y: height / 2, restX: width, restY: height / 2, targetX: width, targetY: height / 2 },
    bottom: { x: width / 2, y: height, restX: width / 2, restY: height, targetX: width / 2, targetY: height },
    left: { x: 0, y: height / 2, restX: 0, restY: height / 2, targetX: 0, targetY: height / 2 },
  });

  const drawPath = () => {
    const p = pointsRef.current;
    const d = `M 0,0 Q ${p.top.x.toFixed(2)},${p.top.y.toFixed(2)} ${width},0 Q ${p.right.x.toFixed(2)},${p.right.y.toFixed(2)} ${width},${height} Q ${p.bottom.x.toFixed(2)},${p.bottom.y.toFixed(2)} 0,${height} Q ${p.left.x.toFixed(2)},${p.left.y.toFixed(2)} 0,0 Z`.trim();
    if (pathRef.current) pathRef.current.setAttribute("d", d);
  };

  useEffect(() => {
    drawPath();
  }, [width, height]);

  const { contextSafe } = useGSAP({ scope: containerRef });

  useGSAP(() => {
    const container = containerRef.current;
    if (!container) return;

    const p = pointsRef.current;
    p.top.restX = width / 2; p.top.restY = 0;
    p.right.restX = width; p.right.restY = height / 2;
    p.bottom.restX = width / 2; p.bottom.restY = height;
    p.left.restX = 0; p.left.restY = height / 2;

    p.top.x = p.top.restX; p.top.y = p.top.restY;
    p.right.x = p.right.restX; p.right.y = p.right.restY;
    p.bottom.x = p.bottom.restX; p.bottom.y = p.bottom.restY;
    p.left.x = p.left.restX; p.left.y = p.left.restY;
    drawPath();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < range) {
        mouseInProximity.current = true;
        const mx = dx + width / 2, my = dy + height / 2;
        const dTop = Math.abs(my), dBottom = Math.abs(my - height), dLeft = Math.abs(mx), dRight = Math.abs(mx - width);
        const minDist = Math.min(dTop, dBottom, dLeft, dRight);

        const targets = {
          topX: p.top.restX, topY: p.top.restY,
          bottomX: p.bottom.restX, bottomY: p.bottom.restY,
          leftX: p.left.restX, leftY: p.left.restY,
          rightX: p.right.restX, rightY: p.right.restY,
        };

        if (minDist === dTop) {
          targets.topY = Math.max(-maxStretch, Math.min(maxStretch, my));
          targets.topX = Math.max(width * 0.2, Math.min(width * 0.8, mx));
        } else if (minDist === dBottom) {
          targets.bottomY = Math.max(height - maxStretch, Math.min(height + maxStretch, my));
          targets.bottomX = Math.max(width * 0.2, Math.min(width * 0.8, mx));
        } else if (minDist === dLeft) {
          targets.leftX = Math.max(-maxStretch, Math.min(maxStretch, mx));
          targets.leftY = Math.max(height * 0.2, Math.min(height * 0.8, my));
        } else {
          targets.rightX = Math.max(width - maxStretch, Math.min(width + maxStretch, mx));
          targets.rightY = Math.max(height * 0.2, Math.min(height * 0.8, my));
        }

        gsap.to(p.top, { x: targets.topX, y: targets.topY, duration: 0.15, overwrite: "auto", onUpdate: drawPath });
        gsap.to(p.bottom, { x: targets.bottomX, y: targets.bottomY, duration: 0.15, overwrite: "auto", onUpdate: drawPath });
        gsap.to(p.left, { x: targets.leftX, y: targets.leftY, duration: 0.15, overwrite: "auto", onUpdate: drawPath });
        gsap.to(p.right, { x: targets.rightX, y: targets.rightY, duration: 0.15, overwrite: "auto", onUpdate: drawPath });

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
      gsap.to(p.top, { x: p.top.restX, y: p.top.restY, duration: 0.8, ease: "elastic.out(1, 0.4)", overwrite: "auto", onUpdate: drawPath });
      gsap.to(p.bottom, { x: p.bottom.restX, y: p.bottom.restY, duration: 0.8, ease: "elastic.out(1, 0.4)", overwrite: "auto", onUpdate: drawPath });
      gsap.to(p.left, { x: p.left.restX, y: p.left.restY, duration: 0.8, ease: "elastic.out(1, 0.4)", overwrite: "auto", onUpdate: drawPath });
      gsap.to(p.right, { x: p.right.restX, y: p.right.restY, duration: 0.8, ease: "elastic.out(1, 0.4)", overwrite: "auto", onUpdate: drawPath });
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
  }, { dependencies: [width, height, range, maxStretch] });

  const handlePointerClick = contextSafe(() => {
    if (disabled) return;
    const p = pointsRef.current;
    const pluckTopY = p.top.restY + (Math.random() > 0.5 ? 1 : -1) * resolvedPluckForce * 0.5;
    const pluckBottomY = p.bottom.restY + (Math.random() > 0.5 ? 1 : -1) * resolvedPluckForce * 0.5;
    const pluckLeftX = p.left.restX + (Math.random() > 0.5 ? 1 : -1) * resolvedPluckForce * 0.5;
    const pluckRightX = p.right.restX + (Math.random() > 0.5 ? 1 : -1) * resolvedPluckForce * 0.5;

    gsap.fromTo(p.top, { y: pluckTopY }, { y: p.top.restY, duration: 1.2, ease: "elastic.out(1.5, 0.3)", overwrite: "auto", onUpdate: drawPath });
    gsap.fromTo(p.bottom, { y: pluckBottomY }, { y: p.bottom.restY, duration: 1.2, ease: "elastic.out(1.5, 0.3)", overwrite: "auto", onUpdate: drawPath });
    gsap.fromTo(p.left, { x: pluckLeftX }, { x: p.left.restX, duration: 1.2, ease: "elastic.out(1.5, 0.3)", overwrite: "auto", onUpdate: drawPath });
    gsap.fromTo(p.right, { x: pluckRightX }, { x: p.right.restX, duration: 1.2, ease: "elastic.out(1.5, 0.3)", overwrite: "auto", onUpdate: drawPath });

    const colorObj = { color: resolvedClickColor };
    gsap.killTweensOf(colorObj);
    setCurrentBgColor(resolvedClickColor);
    gsap.to(colorObj, {
      color: resolvedButtonColor,
      duration: 1.0,
      ease: "power2.out",
      onUpdate: () => setCurrentBgColor(colorObj.color)
    });

    if (onClick) onClick();
  });

  const svgW = width + padX * 2, svgH = height + padY * 2;
  const textColorClass = resolvedButtonColor === "transparent" ? "" : "text-white";
  const textInlineStyle = resolvedButtonColor === "transparent" ? { color: resolvedBorderColor } : {};

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
        className="absolute overflow-visible pointer-events-none drop-shadow-[0_10px_20px_rgba(255,24,0,0.22)]"
        style={{
          width: `${svgW}px`,
          height: `${svgH}px`,
          left: `-${padX}px`,
          top: `-${padY}px`,
        }}
        viewBox={`-${padX} -${padY} ${svgW} ${svgH}`}
      >
        <path
          ref={pathRef}
          fill={currentBgColor}
          stroke={resolvedBorderColor}
          strokeWidth={resolvedBorderWidth}
          className="transition-colors duration-300"
        />
      </svg>

      <button
        ref={textRef}
        type={type}
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={handlePointerClick}
        className={`relative z-10 w-full h-full flex items-center justify-center bg-transparent border-0 p-0 font-sans font-extrabold tracking-wider text-xs transition-transform duration-300 uppercase cursor-pointer pointer-events-auto outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-current disabled:opacity-50 disabled:cursor-not-allowed ${textColorClass}`}
        style={textInlineStyle}
      >
        {children}
      </button>
    </div>
  );
}
