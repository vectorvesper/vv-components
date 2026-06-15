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
  /** Duration in ms to hold shattered before the pieces rejoin */
  impactDelayMs?: number;
  /** Primary button background color */
  buttonColor?: string;
  /** Droplet splatter color (defaults to the button color) */
  particleColor?: string;
  /** Impact color flash highlight (default: '#FFFFFF') */
  clickColor?: string;
  /** Disable interaction (no fall/shatter, dimmed) */
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
  /** Number of splat droplets emitted on collision */
  particleCount?: number;
  /** Minimum radius of emitted splat droplets */
  minRadius?: number;
  /** Maximum radius of emitted splat droplets */
  maxRadius?: number;
  /** Border radius of the button body (default: '16px') */
  borderRadius?: string;
};

interface ChunkParticle {
  id: number;
  x: number; // relative to button center
  y: number; // relative to button center
  vx: number;
  vy: number;
  radius: number;
}

interface ImpactPreset {
  buttonColor?: string;
  particleCount?: number;
  minRadius?: number;
  maxRadius?: number;
  fallDistance?: number;
  impactDelayMs?: number;
  particleColor?: string;
  borderRadius?: string;
}

const PRESETS: Record<"impact" | "drop" | "sticky", ImpactPreset> = {
  impact: { buttonColor: "#A3E635", particleCount: 10, minRadius: 5, maxRadius: 11, fallDistance: 60, impactDelayMs: 350, borderRadius: "16px" },
  drop: { buttonColor: "#EF4444", fallDistance: 150, impactDelayMs: 600, particleCount: 18, borderRadius: "16px" },
  sticky: { buttonColor: "#3B82F6", impactDelayMs: 1000, borderRadius: "16px" },
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
  particleCount,
  minRadius,
  maxRadius,
  borderRadius,
}: ImpactButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gooeyContainerRef = useRef<HTMLDivElement>(null);

  const preset = PRESETS[variant] || PRESETS.impact;
  const resolvedButtonColor = buttonColor ?? preset.buttonColor ?? "#A3E635";
  const resolvedParticleColor = particleColor ?? preset.particleColor ?? resolvedButtonColor;
  const resolvedFallDistance = fallDistance ?? preset.fallDistance ?? 60;
  const resolvedImpactDelayMs = impactDelayMs ?? preset.impactDelayMs ?? 350;
  const resolvedParticleCount = particleCount ?? preset.particleCount ?? 10;
  const resolvedMinRadius = minRadius ?? preset.minRadius ?? 5;
  const resolvedMaxRadius = maxRadius ?? preset.maxRadius ?? 11;
  const resolvedBorderRadius = borderRadius ?? preset.borderRadius ?? "16px";

  const rawId = useId();
  const filterId = `impact-gooey-${rawId.replace(/:/g, "")}`;
  const [currentBgColor, setCurrentBgColor] = useState(resolvedButtonColor);
  const [isBroken, setIsBroken] = useState(false);
  const [renderChunks, setRenderChunks] = useState<ChunkParticle[]>([]);
  const [isGooeyActive, setIsGooeyActive] = useState(false);

  const isAnimating = useRef(false);

  useEffect(() => {
    setCurrentBgColor(resolvedButtonColor);
  }, [resolvedButtonColor]);

  const { contextSafe } = useGSAP({ scope: containerRef });

  // Reassemble: when isBroken flips back to false the button remounts squished
  // at the floor and springs back up to the anchor.
  useGSAP(
    () => {
      if (!isBroken && buttonRef.current) {
        gsap.fromTo(
          buttonRef.current,
          { y: resolvedFallDistance, scaleY: 0.35, scaleX: 1.35 },
          { y: 0, scaleY: 1.0, scaleX: 1.0, duration: 0.8, ease: "elastic.out(1.2, 0.4)", overwrite: "auto" }
        );
      }
    },
    { dependencies: [isBroken, resolvedFallDistance] }
  );

  const handlePointerClick = contextSafe(() => {
    if (disabled || isAnimating.current) return;
    isAnimating.current = true;
    setIsGooeyActive(true);
    setIsBroken(false);
    setRenderChunks([]);
    onClick?.();

    // 1. Fall under gravity.
    gsap.to(buttonRef.current, {
      y: resolvedFallDistance,
      duration: 0.32,
      ease: "power2.in",
      onComplete: () => {
        // 2. Shatter into gooey chunks on impact.
        setIsBroken(true);

        const newChunks: ChunkParticle[] = [];
        const chunkCount = 6;
        for (let i = 0; i < chunkCount; i++) {
          const startX = (i / (chunkCount - 1) - 0.5) * (width - 40);
          newChunks.push({
            id: i,
            x: startX,
            y: resolvedFallDistance,
            vx: (i / (chunkCount - 1) - 0.5) * 8 + (Math.random() - 0.5) * 2,
            vy: -3 - Math.random() * 4,
            radius: 12 + Math.random() * 6,
          });
        }
        setRenderChunks(newChunks);

        // Flash the chunk color toward clickColor and back.
        const colorObj = { color: clickColor };
        gsap.killTweensOf(colorObj);
        setCurrentBgColor(clickColor);
        gsap.to(colorObj, {
          color: resolvedButtonColor,
          duration: 0.8,
          ease: "power2.out",
          onUpdate: () => setCurrentBgColor(colorObj.color),
        });
      },
    });
  });

  // Animate chunks + droplets whenever a fresh shatter mounts.
  useGSAP(
    () => {
      if (renderChunks.length === 0) return;
      const container = gooeyContainerRef.current;
      if (!container) return;

      // Chunks: launch up, then bounce down onto the floor line.
      renderChunks.forEach((c) => {
        const element = document.getElementById(`${filterId}-chunk-${c.id}`);
        if (!element) return;
        const targetX = c.x + c.vx * 15;
        const peakY = c.y + c.vy * 8; // c.vy is the upward impulse
        const floorLimit = resolvedFallDistance + height / 2;

        const tl = gsap.timeline();
        tl.to(element, { x: (c.x + targetX) / 2, y: peakY - height / 2, duration: 0.25, ease: "power1.out" }).to(element, {
          x: targetX,
          y: floorLimit - height / 2,
          duration: 0.45,
          ease: "bounce.out",
        });
      });

      // Splash droplets sliding along the floor.
      const clickY = resolvedFallDistance;
      const spawned: HTMLDivElement[] = [];
      for (let i = 0; i < resolvedParticleCount; i++) {
        const angle = (i / Math.max(1, resolvedParticleCount - 1)) * Math.PI;
        const speed = 4 + Math.random() * 7;
        const radSize = resolvedMinRadius + Math.random() * (resolvedMaxRadius - resolvedMinRadius);

        const particle = document.createElement("div");
        particle.className = "absolute rounded-full pointer-events-none";
        particle.style.width = `${radSize * 2}px`;
        particle.style.height = `${radSize * 2}px`;
        particle.style.backgroundColor = resolvedParticleColor;
        particle.style.left = `calc(50% - ${radSize}px)`;
        particle.style.top = `calc(50% - ${height / 2}px)`;
        particle.style.willChange = "transform";
        container.appendChild(particle);
        spawned.push(particle);

        const targetX = -Math.cos(angle) * speed * 14;
        const targetY = clickY - Math.sin(angle) * speed * 10;

        const tl = gsap.timeline({ onComplete: () => particle.remove() });
        tl.fromTo(
          particle,
          { x: 0, y: clickY, scale: 1, opacity: 1 },
          { x: targetX / 2, y: targetY, scale: 0.8, duration: 0.25, ease: "power1.out" }
        ).to(particle, { x: targetX, y: clickY + 80, scale: 0.1, opacity: 0, duration: 0.35, ease: "power1.in" });
      }

      // 3. Hold shattered, then coalesce chunks back to center and restore.
      const timeout = setTimeout(() => {
        const tl = gsap.timeline({
          onComplete: () => {
            setIsBroken(false);
            setRenderChunks([]);
            isAnimating.current = false;
            setIsGooeyActive(false);
          },
        });
        renderChunks.forEach((c) => {
          const element = document.getElementById(`${filterId}-chunk-${c.id}`);
          if (element) tl.to(element, { x: 0, y: 0, duration: 0.45, ease: "power2.inOut" }, 0);
        });
      }, resolvedImpactDelayMs);

      return () => {
        clearTimeout(timeout);
        spawned.forEach((p) => p.remove());
      };
    },
    { dependencies: [renderChunks, resolvedFallDistance, height, resolvedParticleCount, resolvedMinRadius, resolvedMaxRadius, resolvedParticleColor, resolvedImpactDelayMs] }
  );

  const padX = 120;
  const padY = Math.round(resolvedFallDistance + height + 60);

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

      {/* Gooey layer — only filtered while shattering, so the resting button stays crisp. */}
      <div
        ref={gooeyContainerRef}
        className="relative flex items-center justify-center overflow-visible pointer-events-none w-full h-full"
        style={{ filter: isGooeyActive ? `url(#${filterId}) drop-shadow(0 10px 15px rgba(0,0,0,0.22))` : "none" }}
      >
        {isBroken &&
          renderChunks.map((c) => (
            <div
              key={c.id}
              id={`${filterId}-chunk-${c.id}`}
              className="absolute pointer-events-none"
              style={{
                width: `${c.radius * 2}px`,
                height: `${height}px`,
                borderRadius: `${c.radius}px`,
                backgroundColor: currentBgColor,
                left: `calc(50% - ${c.radius}px)`,
                top: `calc(50% - ${height / 2}px)`,
                willChange: "transform",
              }}
            />
          ))}

        {!isBroken && (
          <button
            ref={buttonRef}
            type={type}
            disabled={disabled}
            aria-label={ariaLabel}
            onClick={handlePointerClick}
            className={`relative z-10 flex items-center justify-center border-0 outline-none cursor-pointer select-none overflow-visible pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-current ${className}`}
            style={{
              width: `${width}px`,
              height: `${height}px`,
              borderRadius: resolvedBorderRadius,
              backgroundColor: currentBgColor,
              transformOrigin: "center bottom",
              willChange: "transform",
              ...style,
            }}
          >
            <span className="relative z-10 flex items-center justify-center w-full h-full px-6 text-black font-sans font-extrabold tracking-wide text-xs pointer-events-none">
              {children}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
