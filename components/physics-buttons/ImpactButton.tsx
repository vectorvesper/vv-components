"use client";

import React, { useEffect, useRef, useState, useId } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export type ImpactButtonProps = {
  /** Button label text */
  children: React.ReactNode;
  /** Predefined style preset: 'impact' | 'drop' | 'sticky' */
  variant?: "impact" | "drop" | "sticky";
  /** Width of the button body in pixels (default: 200) */
  width?: number;
  /** Height of the button body in pixels (default: 56) */
  height?: number;
  /** Fall distance in pixels before hitting the floor */
  fallDistance?: number;
  /** Duration in ms to hold on the floor before springing back */
  impactDelayMs?: number;
  /** Primary button background color */
  buttonColor?: string;
  /** Droplet splatter color (defaults to the button color) */
  particleColor?: string;
  /** Impact color flash highlight (default: '#FFFFFF') */
  clickColor?: string;
  /** Disable interaction (no fall, no splat, dimmed) */
  disabled?: boolean;
  /** Native button type (default: 'button') */
  type?: "button" | "submit" | "reset";
  /** Accessible label, useful when children are icon-only */
  "aria-label"?: string;
  /** Custom CSS class name (applied to the button element) */
  className?: string;
  /** Inline style overrides (applied to the button element) */
  style?: React.CSSProperties;
  /** Action click callback */
  onClick?: () => void;
  /** Spring stiffness — higher springs back faster (default: 0.16) */
  stiffness?: number;
  /** Spring damping — higher overshoots less (default: 0.74) */
  damping?: number;
  /** Vertical squash scale on impact, 0–1 (default: 0.62) */
  squish?: number;
  /** Number of splat droplets emitted on collision */
  particleCount?: number;
  /** Minimum radius of emitted splat droplets */
  minRadius?: number;
  /** Maximum radius of emitted splat droplets */
  maxRadius?: number;
  /** Border radius of the button body (default: '16px') */
  borderRadius?: string;
};

interface ImpactPreset {
  buttonColor?: string;
  stiffness?: number;
  damping?: number;
  particleCount?: number;
  minRadius?: number;
  maxRadius?: number;
  fallDistance?: number;
  impactDelayMs?: number;
  particleColor?: string;
  borderRadius?: string;
  squish?: number;
}

const PRESETS: Record<"impact" | "drop" | "sticky", ImpactPreset> = {
  impact: { buttonColor: "#A3E635", stiffness: 0.16, damping: 0.74, particleCount: 10, minRadius: 5, maxRadius: 11, fallDistance: 60, impactDelayMs: 350, borderRadius: "16px", squish: 0.62 },
  drop: { buttonColor: "#EF4444", fallDistance: 150, impactDelayMs: 600, particleCount: 18, borderRadius: "16px", squish: 0.5 },
  sticky: { buttonColor: "#3B82F6", stiffness: 0.08, damping: 0.9, impactDelayMs: 1000, borderRadius: "16px", squish: 0.78 },
};

export default function ImpactButton({
  children,
  variant = "impact",
  width = 200,
  height = 56,
  fallDistance,
  impactDelayMs,
  buttonColor,
  particleColor,
  clickColor = "#FFFFFF",
  disabled = false,
  type = "button",
  "aria-label": ariaLabel,
  className = "",
  style = {},
  onClick,
  stiffness,
  damping,
  squish,
  particleCount,
  minRadius,
  maxRadius,
  borderRadius,
}: ImpactButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const particleLayerRef = useRef<HTMLDivElement>(null);

  const preset = PRESETS[variant] || PRESETS.impact;
  const resolvedButtonColor = buttonColor ?? preset.buttonColor ?? "#A3E635";
  const resolvedParticleColor = particleColor ?? preset.particleColor ?? resolvedButtonColor;
  const resolvedFallDistance = fallDistance ?? preset.fallDistance ?? 60;
  const resolvedImpactDelayMs = impactDelayMs ?? preset.impactDelayMs ?? 350;
  const resolvedStiffness = stiffness ?? preset.stiffness ?? 0.16;
  const resolvedDamping = damping ?? preset.damping ?? 0.74;
  const resolvedSquish = squish ?? preset.squish ?? 0.62;
  const resolvedParticleCount = particleCount ?? preset.particleCount ?? 10;
  const resolvedMinRadius = minRadius ?? preset.minRadius ?? 5;
  const resolvedMaxRadius = maxRadius ?? preset.maxRadius ?? 11;
  const resolvedBorderRadius = borderRadius ?? preset.borderRadius ?? "16px";

  const rawId = useId();
  const filterId = `impact-gooey-${rawId.replace(/:/g, "")}`;
  const [currentBgColor, setCurrentBgColor] = useState(resolvedButtonColor);
  const isAnimating = useRef(false);

  useEffect(() => {
    setCurrentBgColor(resolvedButtonColor);
  }, [resolvedButtonColor]);

  const { contextSafe } = useGSAP({ scope: containerRef });

  const spawnDroplets = () => {
    const container = particleLayerRef.current;
    if (!container) return;

    const originY = resolvedFallDistance + height / 2; // floor line, relative to layer center
    for (let i = 0; i < resolvedParticleCount; i++) {
      const angle = (i / Math.max(1, resolvedParticleCount - 1)) * Math.PI; // upward arc
      const speed = 4 + Math.random() * 7;
      const radSize = resolvedMinRadius + Math.random() * (resolvedMaxRadius - resolvedMinRadius);

      const particle = document.createElement("div");
      particle.className = "absolute rounded-full pointer-events-none";
      particle.style.width = `${radSize * 2}px`;
      particle.style.height = `${radSize * 2}px`;
      particle.style.backgroundColor = resolvedParticleColor;
      particle.style.left = `calc(50% - ${radSize}px)`;
      particle.style.top = `calc(50% - ${radSize}px)`;
      particle.style.willChange = "transform";
      container.appendChild(particle);

      const targetX = -Math.cos(angle) * speed * 14;
      const peakY = originY - Math.sin(angle) * speed * 10;

      const tl = gsap.timeline({ onComplete: () => particle.remove() });
      tl.fromTo(
        particle,
        { x: 0, y: originY, scale: 1, opacity: 1 },
        { x: targetX / 2, y: peakY, scale: 0.85, duration: 0.25, ease: "power1.out" }
      ).to(particle, {
        x: targetX,
        y: originY + 70,
        scale: 0.1,
        opacity: 0,
        duration: 0.35,
        ease: "power1.in",
      });
    }
  };

  const handlePointerClick = contextSafe(() => {
    if (disabled || isAnimating.current) return;
    isAnimating.current = true;
    onClick?.();

    const button = buttonRef.current;
    if (!button) return;

    // Map the spring props onto an elastic recovery.
    const springEase = `elastic.out(${(1 + (1 - resolvedDamping)).toFixed(2)}, 0.4)`;
    const springDuration = gsap.utils.clamp(0.35, 1.4, 0.4 + (1 - resolvedStiffness) * 1.2);
    const holdSec = resolvedImpactDelayMs / 1000;

    const tl = gsap.timeline({
      onComplete: () => {
        isAnimating.current = false;
      },
    });

    // 1. Fall under "gravity".
    tl.to(button, { y: resolvedFallDistance, duration: 0.32, ease: "power2.in" })
      // 2. Impact: flash, squash onto the floor, and spray droplets.
      .add(() => {
        const colorObj = { color: clickColor };
        gsap.killTweensOf(colorObj);
        setCurrentBgColor(clickColor);
        gsap.to(colorObj, {
          color: resolvedButtonColor,
          duration: 0.8,
          ease: "power2.out",
          onUpdate: () => setCurrentBgColor(colorObj.color),
        });
        spawnDroplets();
      })
      .to(button, { scaleY: resolvedSquish, scaleX: 2 - resolvedSquish, duration: 0.09, ease: "power1.out" })
      // 3. Wobble the squash out.
      .to(button, { scaleY: 1, scaleX: 1, duration: 0.45, ease: "elastic.out(1.4, 0.4)" })
      // 4. Hold on the floor, then spring back to the anchor.
      .to(button, { y: 0, duration: springDuration, ease: springEase }, `+=${holdSec}`);
  });

  // Reserve enough room below the button for the fall + droplet arc.
  const padY = Math.round(resolvedFallDistance + height + 80);
  const padX = 100;

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center select-none overflow-visible box-content w-fit h-fit shrink-0"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        padding: `${padY}px ${padX}px`,
        margin: `-${padY}px -${padX}px`,
      }}
    >
      <svg style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }} aria-hidden="true">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="6.5" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="over" />
          </filter>
        </defs>
      </svg>

      {/* Gooey droplet layer — the ONLY filtered element. Fills the padded
          container so its 50% center aligns with the button's rest position. */}
      <div
        ref={particleLayerRef}
        aria-hidden="true"
        className="absolute inset-0 z-0 flex items-center justify-center overflow-visible pointer-events-none"
        style={{ filter: `url(#${filterId})` }}
      />

      {/* Crisp rectangular button — falls, squashes, and springs back without melting. */}
      <button
        ref={buttonRef}
        type={type}
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={handlePointerClick}
        className={`relative z-10 flex items-center justify-center border-0 outline-none cursor-pointer select-none overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-current ${className}`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: resolvedBorderRadius,
          backgroundColor: currentBgColor,
          transformOrigin: "center bottom",
          boxShadow: "0 10px 20px rgba(0,0,0,0.18)",
          willChange: "transform",
          ...style,
        }}
      >
        <span className="relative z-10 flex items-center justify-center w-full h-full px-6 text-black font-sans font-extrabold tracking-wide text-xs pointer-events-none">
          {children}
        </span>
      </button>
    </div>
  );
}
