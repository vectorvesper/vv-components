"use client";

import React, { useEffect, useRef, useState, useId } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export type SplashButtonProps = {
  /** Inside button element (e.g. icon or text) */
  children: React.ReactNode;
  /** Predefined style preset: 'splash' | 'splatter' | 'mist' */
  variant?: "splash" | "splatter" | "mist";
  /** Width of the button body in pixels (default: 200) */
  width?: number;
  /** Height of the button body in pixels (default: 56) */
  height?: number;
  /** Border radius of the button (default: '16px') */
  borderRadius?: string;
  /** Proximity range in pixels for cursor magnetic attraction (default: 140) */
  range?: number;
  /** Strength coefficient for magnetic attraction (default: 0.3) */
  strength?: number;
  /** Background color of the button */
  buttonColor?: string;
  /** Color of the splash particles (defaults to the button color) */
  particleColor?: string;
  /** Highlight color flashed when clicked (default: '#FFFFFF') */
  clickColor?: string;
  /** Disable interaction (no magnetic pull, no splash, dimmed) */
  disabled?: boolean;
  /** Native button type (default: 'button') */
  type?: "button" | "submit" | "reset";
  /** Accessible label, useful when children are icon-only */
  "aria-label"?: string;
  /** Custom CSS class name (applied to the button element) */
  className?: string;
  /** Inline style overrides (applied to the button element) */
  style?: React.CSSProperties;
  /** Click event callback */
  onClick?: () => void;
  /** Number of particles emitted on click */
  particleCount?: number;
  /** Minimum velocity speed of spawned particles */
  minSpeed?: number;
  /** Maximum velocity speed of spawned particles */
  maxSpeed?: number;
  /** Minimum radius size of spawned particles in pixels */
  minRadius?: number;
  /** Maximum radius size of spawned particles in pixels */
  maxRadius?: number;
};

interface SplashPreset {
  buttonColor?: string;
  particleColor?: string;
  particleCount?: number;
  minSpeed?: number;
  maxSpeed?: number;
  minRadius?: number;
  maxRadius?: number;
}

const PRESETS: Record<"splash" | "splatter" | "mist", SplashPreset> = {
  splash: { buttonColor: "#F59E0B", particleCount: 12, minSpeed: 7, maxSpeed: 15, minRadius: 6, maxRadius: 14 },
  splatter: { buttonColor: "#EC4899", particleColor: "#F472B6", particleCount: 30, minSpeed: 12, maxSpeed: 28, minRadius: 8, maxRadius: 20 },
  mist: { buttonColor: "#06B6D4", particleCount: 20, minSpeed: 3, maxSpeed: 8, minRadius: 2, maxRadius: 6 },
};

export default function SplashButton({
  children,
  variant = "splash",
  width = 200,
  height = 56,
  borderRadius = "16px",
  range = 140,
  strength = 0.3,
  buttonColor,
  particleColor,
  clickColor = "#FFFFFF",
  disabled = false,
  type = "button",
  "aria-label": ariaLabel,
  className = "",
  style = {},
  onClick,
  particleCount,
  minSpeed,
  maxSpeed,
  minRadius,
  maxRadius,
}: SplashButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const particleLayerRef = useRef<HTMLDivElement>(null);

  const preset = PRESETS[variant] || PRESETS.splash;
  const resolvedButtonColor = buttonColor ?? preset.buttonColor ?? "#F59E0B";
  const resolvedParticleColor = particleColor ?? preset.particleColor ?? resolvedButtonColor;
  const resolvedParticleCount = particleCount ?? preset.particleCount ?? 12;
  const resolvedMinSpeed = minSpeed ?? preset.minSpeed ?? 7;
  const resolvedMaxSpeed = maxSpeed ?? preset.maxSpeed ?? 15;
  const resolvedMinRadius = minRadius ?? preset.minRadius ?? 6;
  const resolvedMaxRadius = maxRadius ?? preset.maxRadius ?? 14;

  const rawId = useId();
  const filterId = `gooey-splash-${rawId.replace(/:/g, "")}`;
  const [currentBgColor, setCurrentBgColor] = useState(resolvedButtonColor);

  useEffect(() => {
    setCurrentBgColor(resolvedButtonColor);
  }, [resolvedButtonColor]);

  // Keep the latest disabled value available to the imperative mousemove handler.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const mouseRef = useRef({ x: 0, y: 0 });

  const { contextSafe } = useGSAP({ scope: containerRef });

  const handlePointerClick = contextSafe(() => {
    if (disabled) return;

    // Flash the body color, then ease back.
    const colorObj = { color: clickColor };
    gsap.killTweensOf(colorObj);
    setCurrentBgColor(clickColor);
    gsap.to(colorObj, {
      color: resolvedButtonColor,
      duration: 1.0,
      ease: "power2.out",
      onUpdate: () => setCurrentBgColor(colorObj.color),
    });

    // Emit gooey droplets into the (filtered) particle layer — never the body.
    const container = particleLayerRef.current;
    if (container) {
      const clickX = mouseRef.current.x * strength;
      const clickY = mouseRef.current.y * strength;

      for (let i = 0; i < resolvedParticleCount; i++) {
        const angle = (i / resolvedParticleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const speed = resolvedMinSpeed + Math.random() * (resolvedMaxSpeed - resolvedMinSpeed);
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

        const targetX = clickX + Math.cos(angle) * speed * 7;
        const targetY = clickY + Math.sin(angle) * speed * 7;

        gsap.fromTo(
          particle,
          { x: clickX, y: clickY, scale: 1, opacity: 1 },
          {
            x: targetX,
            y: targetY,
            scale: 0.1,
            opacity: 0,
            duration: 0.6 + Math.random() * 0.4,
            ease: "power2.out",
            onComplete: () => particle.remove(),
          }
        );
      }
    }

    onClick?.();
  });

  useGSAP(() => {
    const container = containerRef.current;
    if (!container) return;

    let active = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (disabledRef.current) return;
      const rect = container.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const inRange = Math.sqrt(dx * dx + dy * dy) < range;

      mouseRef.current.x = inRange ? dx : 0;
      mouseRef.current.y = inRange ? dy : 0;

      if (inRange) {
        active = true;
        gsap.to(wrapperRef.current, {
          x: dx * strength,
          y: dy * strength,
          duration: 0.15,
          overwrite: "auto",
        });
      } else if (active) {
        active = false;
        handleMouseLeave();
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = mouseRef.current.y = 0;
      gsap.to(wrapperRef.current, {
        x: 0,
        y: 0,
        duration: 0.6,
        ease: "elastic.out(1.2, 0.4)",
        overwrite: "auto",
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [range, strength]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center select-none overflow-visible box-content w-fit h-fit shrink-0"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        padding: `${range / 2}px`,
        margin: `-${range / 2}px`,
      }}
    >
      <svg style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }} aria-hidden="true">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="6.5" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="over" />
          </filter>
        </defs>
      </svg>

      {/* Magnetic wrapper — translates the crisp body and the splash layer together. */}
      <div ref={wrapperRef} className="relative" style={{ width: `${width}px`, height: `${height}px` }}>
        {/* Gooey particle layer — the ONLY filtered element, so the body stays crisp. */}
        <div
          ref={particleLayerRef}
          aria-hidden="true"
          className="absolute inset-0 z-0 overflow-visible pointer-events-none"
          style={{ filter: `url(#${filterId})` }}
        />

        {/* Crisp rectangular button — a real <button> for focus, keyboard & disabled. */}
        <button
          type={type}
          disabled={disabled}
          aria-label={ariaLabel}
          onClick={handlePointerClick}
          className={`relative z-10 flex items-center justify-center w-full h-full overflow-hidden border-0 outline-none cursor-pointer select-none transition-transform duration-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-current ${className}`}
          style={{
            borderRadius,
            backgroundColor: currentBgColor,
            boxShadow: "0 10px 20px rgba(0,0,0,0.18)",
            ...style,
          }}
        >
          <span className="relative z-10 flex items-center justify-center w-full h-full px-6 pointer-events-none">
            {children}
          </span>
        </button>
      </div>
    </div>
  );
}
