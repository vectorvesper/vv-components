"use client";

import React, { useEffect, useRef, useState, useId } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// Deterministic pseudo-random in [0,1). Seeding by particle index keeps the
// server-rendered and client-rendered particle sizes identical, avoiding React
// hydration mismatches (Math.random() would differ between the two renders).
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export type SlimeButtonProps = {
  /** Text or element to display inside the button */
  children: React.ReactNode;
  /** Predefined style preset: 'slime' | 'orbit' | 'square' */
  variant?: "slime" | "orbit" | "square";
  /** Proximity range (in pixels) inside which the button attracts the mouse */
  range?: number;
  /** Strength multiplier for button body translation */
  strength?: number;
  /** Number of gooey fluid droplets to emit */
  particleCount?: number;
  /** Color of the button background */
  buttonColor?: string;
  /** Color of the floating fluid particles */
  particleColor?: string;
  /** Highlight color flashed when clicked */
  clickColor?: string;
  /** Downward gravitational acceleration force */
  gravity?: number;
  /** Speed of the idle halo orbit rotation around the button */
  haloSpeed?: number;
  /** Border radius of the button */
  borderRadius?: string;
  /** Disable interaction (no animation, dimmed, not activatable) */
  disabled?: boolean;
  /** Native button type (default: 'button') */
  type?: "button" | "submit" | "reset";
  /** Accessible label, useful when children are icon-only */
  "aria-label"?: string;
  /** Click handler */
  onClick?: () => void;
  /** Custom CSS classes */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Delay in seconds before droplets snap back to resting anchors on mouse release */
  releaseTimeSec?: number;
  /** Recoil wobble vertical stretch velocity on release to simulate splash impact */
  recoilIntensity?: number;
  /** Gaussian standard deviation blur for gooey outline resolution */
  stdDeviation?: number;
  /** Squish wobble vertical squish velocity impulse on click */
  squishIntensity?: number;
  /** Minimum CSS width of the button core */
  minWidth?: string;
  /** CSS height of the button core */
  height?: string;
};

interface ParticleState {
  x: number;      // current x position relative to button center
  y: number;      // current y position relative to button center
  vx: number;     // velocity x
  vy: number;     // velocity y
  targetX: number; // default anchor position x
  targetY: number; // default anchor position y
  radius: number;  // radius size of the particle
  speedFactor: number; // unique speed variation
  dist: number;      // resting distance from center
  baseAngle: number; // starting angle in radians
}

interface SlimePreset {
  buttonColor?: string;
  gravity?: number;
  particleCount?: number;
  releaseTimeSec?: number;
  recoilIntensity?: number;
  stdDeviation?: number;
  haloSpeed?: number;
  borderRadius?: string;
}

const PRESETS: Record<"slime" | "orbit" | "square", SlimePreset> = {
  slime: { buttonColor: "#ADFA1D", gravity: 0.55, particleCount: 8, releaseTimeSec: 2.0, recoilIntensity: 0.22, stdDeviation: 8.5 },
  orbit: { buttonColor: "#3B82F6", gravity: 0.0, haloSpeed: 2.2, particleCount: 6 },
  square: { buttonColor: "#EC4899", borderRadius: "16px", gravity: 0.0, particleCount: 8, stdDeviation: 6.5 },
};

export default function SlimeButton({
  children,
  variant = "slime",
  range = 150,
  strength = 0.3,
  particleCount,
  buttonColor,
  particleColor,
  clickColor = "#FFFFFF",
  disabled = false,
  type = "button",
  "aria-label": ariaLabel,
  gravity,
  haloSpeed,
  borderRadius,
  onClick,
  className = "",
  style = {},
  releaseTimeSec,
  recoilIntensity,
  stdDeviation,
  squishIntensity = -0.35,
  minWidth = "160px",
  height = "56px",
}: SlimeButtonProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLButtonElement>(null);
  const particlesContainerRef = useRef<HTMLDivElement>(null);

  const preset = PRESETS[variant] || PRESETS.slime;
  const resolvedParticleCount = particleCount ?? preset.particleCount ?? 5;
  const resolvedButtonColor = buttonColor ?? preset.buttonColor ?? "#FF1800";
  const resolvedParticleColor = particleColor ?? resolvedButtonColor;
  const resolvedGravity = gravity ?? preset.gravity ?? 0;
  const resolvedHaloSpeed = haloSpeed ?? preset.haloSpeed ?? 0;
  const resolvedBorderRadius = borderRadius ?? preset.borderRadius ?? "9999px";
  const resolvedReleaseTimeSec = releaseTimeSec ?? preset.releaseTimeSec ?? 2.0;
  const resolvedRecoilIntensity = recoilIntensity ?? preset.recoilIntensity ?? 0.22;
  const resolvedStdDeviation = stdDeviation ?? preset.stdDeviation ?? 8.5;

  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, active: false });
  const physicsRef = useRef({ squishY: 1.0 });
  const releaseTimeRef = useRef<number | null>(null);
  const particlesRef = useRef<ParticleState[]>([]);
  const tickerActiveRef = useRef(false);

  const rawId = useId();
  const filterId = `gooey-filter-${rawId.replace(/:/g, "")}`;
  const [currentBgColor, setCurrentBgColor] = useState(resolvedButtonColor);

  useEffect(() => {
    setCurrentBgColor(resolvedButtonColor);
  }, [resolvedButtonColor]);

  // Initialise particles once
  if (particlesRef.current.length !== resolvedParticleCount) {
    const list: ParticleState[] = [];
    for (let i = 0; i < resolvedParticleCount; i++) {
      const angle = (i / resolvedParticleCount) * Math.PI * 2;
      const dist = 24 + seededRandom(i + 1) * 14;
      
      let sx = 0;
      let sy = 0;
      
      if (variant === "square") {
        // Project onto a square boundary of width 140 (w=70) and height 44 (h=22)
        const w = 70;
        const h = 22;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const scale = Math.min(1 / Math.abs(cos), 1 / Math.abs(sin));
        sx = cos * scale * w;
        sy = sin * scale * h;
      } else {
        const startAtOffset = resolvedHaloSpeed > 0;
        sx = startAtOffset ? Math.cos(angle) * dist : 0;
        sy = startAtOffset ? Math.sin(angle) * dist : 0;
      }

      list.push({
        x: sx, y: sy, vx: 0, vy: 0,
        targetX: sx,
        targetY: sy,
        radius: 8 + seededRandom(i + 100) * 8,
        speedFactor: 0.08 + seededRandom(i + 200) * 0.08,
        dist,
        baseAngle: angle,
      });
    }
    particlesRef.current = list;
  }

  const startOrbitRotation = () => {
    if (resolvedHaloSpeed > 0 && particlesContainerRef.current) {
      gsap.to(particlesContainerRef.current, {
        rotation: 360,
        duration: 30 / resolvedHaloSpeed,
        repeat: -1,
        ease: "none",
        overwrite: "auto"
      });
    }
  };

  const stopOrbitRotation = () => {
    if (particlesContainerRef.current) {
      gsap.killTweensOf(particlesContainerRef.current);
      gsap.set(particlesContainerRef.current, { rotation: 0 });
    }
  };

  const startBreathing = () => {
    if (variant === "square") {
      particlesRef.current.forEach((_, idx) => {
        const element = document.getElementById(`${filterId}-part-${idx}`);
        if (element) {
          gsap.to(element, {
            scale: 1.35,
            duration: 1.2 + Math.random() * 0.4,
            yoyo: true,
            repeat: -1,
            ease: "power1.inOut",
            delay: idx * 0.1,
            overwrite: "auto"
          });
        }
      });
    }
  };

  const stopBreathing = () => {
    particlesRef.current.forEach((_, idx) => {
      const element = document.getElementById(`${filterId}-part-${idx}`);
      if (element) {
        gsap.killTweensOf(element);
        gsap.to(element, { scale: 1, duration: 0.3, overwrite: "auto" });
      }
    });
  };

  let lastTime = performance.now();
  let timeElapsed = 0;

  const updateParticles = () => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    timeElapsed += dt;

    const mouse = mouseRef.current;
    const isHoldingRelease = !mouse.active && releaseTimeRef.current !== null && 
      (performance.now() - releaseTimeRef.current) / 1000 < resolvedReleaseTimeSec;

    const isStateActive = mouse.active || isHoldingRelease;

    // Smooth mouse coordinate magnetics tracking
    const targetX = mouse.active ? mouse.targetX : 0;
    const targetY = mouse.active ? mouse.targetY : 0;
    mouse.x += (targetX - mouse.x) * 0.12;
    mouse.y += (targetY - mouse.y) * 0.12;

    const tx = mouse.x * strength;
    const ty = mouse.y * strength;
    const sY = physicsRef.current.squishY;
    const sX = 2.0 - sY;

    // Apply combined translation + scale
    const tStr = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${sX.toFixed(3)}, ${sY.toFixed(3)})`;
    if (buttonRef.current) buttonRef.current.style.transform = tStr;
    if (textRef.current) textRef.current.style.transform = `translate3d(-50%, -50%, 0) ${tStr}`;

    // Update each gooey particle position
    particlesRef.current.forEach((p, idx) => {
      const element = document.getElementById(`${filterId}-part-${idx}`);
      if (!element) return;

      let fx = 0, fy = 0;
      if (mouse.active) {
        fx = (mouse.x - p.x) * p.speedFactor;
        fy = (mouse.y - p.y) * p.speedFactor;
      } else {
        if (resolvedHaloSpeed > 0) {
          const angle = p.baseAngle + timeElapsed * resolvedHaloSpeed;
          p.targetX = Math.cos(angle) * p.dist;
          p.targetY = Math.sin(angle) * p.dist;
        } else if (variant === "square") {
          // Stay anchored to pre-calculated square boundary anchors
          p.targetX = p.targetX;
          p.targetY = p.targetY;
        } else if (!isHoldingRelease) {
          p.targetX = p.targetY = 0;
        }
        const k = isHoldingRelease ? 0.28 : 0.15;
        fx = (p.targetX - p.x) * k;
        fy = (p.targetY - p.y) * k;
      }

      p.vx = (p.vx + fx) * 0.82;
      p.vy = (p.vy + fy) * 0.82 + (resolvedGravity > 0 && isStateActive ? resolvedGravity : 0);
      p.x += p.vx;
      p.y += p.vy;

      element.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    });

    // Determine if everything has settled to rest
    const isSquishing = gsap.isTweening(physicsRef.current);
    if (!mouse.active && !isHoldingRelease && !isSquishing) {
      let allSettled = true;
      particlesRef.current.forEach((p) => {
        const distToTarget = Math.sqrt((p.targetX - p.x) ** 2 + (p.targetY - p.y) ** 2);
        if (distToTarget > 0.5 || Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1) {
          allSettled = false;
        }
      });

      if (allSettled) {
        // Snap to clean resting shapes
        particlesRef.current.forEach((p, idx) => {
          const element = document.getElementById(`${filterId}-part-${idx}`);
          if (element) {
            element.style.transform = `translate3d(${p.targetX.toFixed(1)}px, ${p.targetY.toFixed(1)}px, 0)`;
            p.x = p.targetX;
            p.y = p.targetY;
            p.vx = 0;
            p.vy = 0;
          }
        });

        stopTicker();
        startOrbitRotation();
        startBreathing();
      }
    }
  };

  const startTicker = () => {
    if (!tickerActiveRef.current) {
      tickerActiveRef.current = true;
      lastTime = performance.now();
      gsap.ticker.add(updateParticles);
    }
  };

  const stopTicker = () => {
    if (tickerActiveRef.current) {
      tickerActiveRef.current = false;
      gsap.ticker.remove(updateParticles);
    }
  };

  const { contextSafe } = useGSAP({ scope: containerRef });

  const handlePointerClick = contextSafe(() => {
    if (disabled) return;
    // Click squish feedback wobble
    gsap.fromTo(physicsRef.current,
      { squishY: 1 + squishIntensity },
      {
        squishY: 1.0,
        duration: 1.2,
        ease: "elastic.out(1.5, 0.3)",
        overwrite: "auto",
        onStart: startTicker
      }
    );

    // Flash background color
    const colorObj = { color: clickColor };
    gsap.killTweensOf(colorObj);
    setCurrentBgColor(clickColor);
    gsap.to(colorObj, {
      color: resolvedButtonColor,
      duration: 1.0,
      ease: "power2.out",
      onUpdate: () => setCurrentBgColor(colorObj.color)
    });

    // Click particles splatter timeline injection
    const container = particlesContainerRef.current;
    if (container) {
      const clickX = mouseRef.current.x * strength;
      const clickY = mouseRef.current.y * strength;
      const count = 8;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const speed = 5 + Math.random() * 6;
        const radSize = 5 + Math.random() * 6;

        const particle = document.createElement("div");
        particle.className = "absolute rounded-full pointer-events-none";
        particle.style.width = `${radSize * 2}px`;
        particle.style.height = `${radSize * 2}px`;
        particle.style.backgroundColor = resolvedParticleColor;
        particle.style.left = `calc(50% - ${radSize}px)`;
        particle.style.top = `calc(50% - ${radSize}px)`;
        particle.style.willChange = "transform";
        
        container.appendChild(particle);

        const targetX = clickX + Math.cos(angle) * speed * 8;
        const targetY = clickY + Math.sin(angle) * speed * 8;

        const tl = gsap.timeline({ onComplete: () => particle.remove() });
        if (resolvedGravity > 0) {
          const peakY = clickY + Math.sin(angle) * speed * 4 - 20;
          tl.fromTo(particle, 
            { x: clickX, y: clickY, scale: 1, opacity: 1 },
            { x: (clickX + targetX) / 2, y: peakY, scale: 0.8, duration: 0.25, ease: "power1.out" }
          ).to(particle, {
            x: targetX,
            y: targetY + 60,
            scale: 0.1,
            opacity: 0,
            duration: 0.35,
            ease: "power1.in"
          });
        } else {
          tl.fromTo(particle,
            { x: clickX, y: clickY, scale: 1, opacity: 1 },
            { x: targetX, y: targetY, scale: 0.1, opacity: 0, duration: 0.6, ease: "power2.out" }
          );
        }
      }
    }

    if (onClick) onClick();
  });

  useGSAP(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const inRange = Math.sqrt(dx * dx + dy * dy) < range;

      mouseRef.current.targetX = inRange ? dx : 0;
      mouseRef.current.targetY = inRange ? dy : 0;
      
      if (inRange) {
        if (!mouseRef.current.active) {
          mouseRef.current.active = true;
          stopOrbitRotation();
          stopBreathing();
          startTicker();
        }
      } else {
        if (mouseRef.current.active) {
          mouseRef.current.active = false;
          handleMouseLeave();
        }
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.targetX = 0;
      mouseRef.current.targetY = 0;
      releaseTimeRef.current = performance.now();
      
      // Wobble squish on release
      gsap.fromTo(physicsRef.current,
        { squishY: 1 + resolvedRecoilIntensity },
        {
          squishY: 1.0,
          duration: 1.0,
          ease: "elastic.out(1.2, 0.4)",
          overwrite: "auto",
          onStart: startTicker
        }
      );
    };

    window.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    // Initial state setup
    startOrbitRotation();
    startBreathing();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      stopTicker();
      stopBreathing();
    };
  }, [range, strength, resolvedGravity, resolvedHaloSpeed, resolvedReleaseTimeSec, resolvedRecoilIntensity]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center select-none overflow-visible box-content w-fit h-fit shrink-0 ${className}`}
      style={{
        padding: `${range / 2}px`,
        margin: `-${range / 2}px`,
        ...style,
      }}
    >
      {filterId && (
        <svg style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}>
          <defs>
            <filter id={filterId}>
              <feGaussianBlur in="SourceGraphic" stdDeviation={resolvedStdDeviation.toFixed(1)} result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
              <feComposite in="SourceGraphic" in2="goo" operator="over" />
            </filter>
          </defs>
        </svg>
      )}

      <div
        className="relative flex items-center justify-center overflow-visible pointer-events-none w-full h-full"
        style={{ filter: filterId ? `url(#${filterId}) drop-shadow(0 10px 15px rgba(0,0,0,0.22))` : "none" }}
      >
        <div
          ref={particlesContainerRef}
          className="absolute inset-0 flex items-center justify-center overflow-visible pointer-events-none"
        >
          {particlesRef.current.map((p, idx) => (
            <div
              key={idx}
              id={`${filterId}-part-${idx}`}
              className="absolute rounded-full transition-colors duration-300 animate-pulse-slow-none"
              style={{
                width: `${p.radius * 2}px`,
                height: `${p.radius * 2}px`,
                backgroundColor: currentBgColor === resolvedButtonColor ? resolvedParticleColor : currentBgColor,
                left: `calc(50% - ${p.radius}px)`,
                top: `calc(50% - ${p.radius}px)`,
                transform: `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`,
              }}
            />
          ))}
        </div>

        <div
          ref={buttonRef}
          className="relative pointer-events-auto cursor-pointer transition-all duration-300 active:scale-95 overflow-hidden"
          style={{
            backgroundColor: currentBgColor,
            borderRadius: resolvedBorderRadius,
            minWidth,
            height,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent pointer-events-none opacity-80" style={{ borderRadius: resolvedBorderRadius }} />
        </div>
      </div>

      <button
        ref={textRef}
        type={type}
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={handlePointerClick}
        className="absolute z-10 pointer-events-auto cursor-pointer bg-transparent border-0 p-0 font-sans flex items-center justify-center font-bold tracking-wide transition-all duration-300 active:scale-95 text-black outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-current disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          minWidth,
          height,
          top: "50%",
          left: "50%",
          transform: "translate3d(-50%, -50%, 0)",
        }}
      >
        {children}
      </button>
    </div>
  );
}
