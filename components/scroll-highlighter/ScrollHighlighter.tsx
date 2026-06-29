"use client";

import React, { useEffect, useState, useId, useMemo } from "react";
import {
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  motion,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";

function getWordSeed(index: number): number {
  const x = Math.sin(index + 1) * 10000;
  return x - Math.floor(x);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export interface SpringConfig {
  damping: number;
  stiffness: number;
  mass: number;
}

export const PHYSICS_PROFILES = {
  gentle:  { damping: 25, stiffness: 140, mass: 0.6 },
  buttery: { damping: 35, stiffness: 100, mass: 1.0 },
  snappy:  { damping: 22, stiffness: 200, mass: 0.5 },
  bouncy:  { damping: 12, stiffness: 90,  mass: 0.8 },
} as const satisfies Record<string, SpringConfig>;

export type PhysicsProfileName = keyof typeof PHYSICS_PROFILES;

export interface ScrollHighlighterProps {
  text: string;
  sticky?: boolean;
  fullscreen?: boolean;
  scrollSpeed?: number;
  customProgress?: MotionValue<number>;
  offset?: [string, string];
  textColor?: string;
  activeTextColor?: string;
  baseFontOpacity?: number;
  activeFont?: "default" | "dramatic";
  baseFontClass?: string;
  dramaticFontClass?: string;
  variant?: "solid" | "wavy" | "dotted";
  highlightColor?: string;
  gradientColors?: [string, string];
  highlightOpacity?: number;
  highlightHeight?: number;
  highlightY?: number;
  overlap?: number;
  smooth?: boolean;
  physicsProfile?: PhysicsProfileName;
  springConfig?: SpringConfig;
  hoverGlow?: boolean;
  className?: string;
}

interface WordProps {
  word: string;
  index: number;
  total: number;
  instanceId: string;
  progress: MotionValue<number>;
  highlightColor: string;
  gradientColors?: [string, string];
  highlightOpacity: number;
  textColor: string;
  activeTextColor: string;
  baseFontOpacity: number;
  highlightHeight: number;
  highlightY: number;
  variant: "solid" | "wavy" | "dotted";
  activeFont: "default" | "dramatic";
  baseFontClass: string;
  dramaticFontClass: string;
  overlap: number;
  hoverGlow: boolean;
  shouldReduceMotion: boolean;
}

const Word = React.memo(function Word({
  word,
  index,
  total,
  instanceId,
  progress,
  highlightColor,
  gradientColors,
  highlightOpacity,
  textColor,
  activeTextColor,
  baseFontOpacity,
  highlightHeight,
  highlightY,
  variant,
  activeFont,
  baseFontClass,
  dramaticFontClass,
  overlap,
  hoverGlow,
  shouldReduceMotion,
}: WordProps) {
  const wordStart = index / total;
  const wordEnd = Math.min(1, (index + overlap) / total);
  const wordMid = (wordStart + wordEnd) / 2;
  const rangeStart = Math.max(wordStart, wordMid - 0.02 / total);
  const rangeEnd = Math.min(wordEnd, wordMid + 0.02 / total);

  const scaleX = useTransform(progress, [wordStart, wordEnd], [0, 1], { clamp: true });
  const clipWidth = useTransform(scaleX, [0, 1], [0, 100], { clamp: true });
  const color = useTransform(progress, [wordStart, wordEnd], [textColor, activeTextColor], { clamp: true });
  const opacity = useTransform(progress, [wordStart, wordEnd], [baseFontOpacity, 1], { clamp: true });

  const opacityNormal = useTransform(
    progress,
    [wordStart, rangeStart, rangeEnd],
    [baseFontOpacity, baseFontOpacity, 0],
    { clamp: true }
  );
  const opacityActive = useTransform(
    progress,
    [wordStart, rangeStart, rangeEnd],
    [0, 0, 1],
    { clamp: true }
  );

  const strokeOpacity = useTransform(scaleX, [0, 0.05, 0.08, 1], [0, 0, 1, 1], { clamp: true });
  const finalStrokeOpacity = useTransform(strokeOpacity, (v) => v * highlightOpacity);

  const dottedOpacity = useTransform(scaleX, [0, 0.02, 1], [0, 1, 1], { clamp: true });
  const finalDottedOpacity = useTransform(dottedOpacity, (v) => v * highlightOpacity);

  const isDramatic = activeFont === "dramatic";

  const { skewY, yShift, hVar, borderRadius, solidBgStyle } = useMemo(() => {
    const seed = getWordSeed(index);
    return {
      skewY: (seed * 2 - 1) * 0.8,
      yShift: seed * 3.5 - 1.75,
      hVar: 0.93 + seed * 0.14,
      borderRadius: [
        Math.round(1 + seed * 4),
        Math.round(2 + getWordSeed(index + 1) * 3),
        Math.round(1 + getWordSeed(index + 2) * 5),
        Math.round(3 + getWordSeed(index + 3) * 3),
      ].map((r) => `${r}px`).join(" "),
      solidBgStyle: {
        backgroundColor: gradientColors ? undefined : highlightColor,
        backgroundImage: gradientColors
          ? `linear-gradient(90deg, ${gradientColors[0]}, ${gradientColors[1]})`
          : undefined,
      },
    };
  }, [index, gradientColors, highlightColor]);

  const gradientId = `sh-grad-${instanceId}-${index}`;
  const clipId = `sh-clip-${instanceId}-${index}`;

  return (
    <motion.span
      style={{
        position: "relative",
        display: "inline-block",
        isolation: "isolate",
        willChange: "transform",
        cursor: hoverGlow && !shouldReduceMotion ? "pointer" : undefined,
        ...(isDramatic ? {} : { color, opacity }),
      }}
      whileHover={
        hoverGlow && !shouldReduceMotion
          ? {
              scale: 1.06,
              y: -2,
              filter: "drop-shadow(0 4px 8px rgba(255,255,255,0.06))",
              transition: { type: "spring", stiffness: 450, damping: 16 },
            }
          : undefined
      }
    >
      {variant === "wavy" ? (
        <motion.svg
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            pointerEvents: "none",
            overflow: "visible",
            height: `${highlightHeight * 100}%`,
            top: `${highlightY * 100}%`,
            width: "100%",
            zIndex: -1,
            opacity: finalStrokeOpacity,
          }}
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
        >
          {gradientColors && (
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={gradientColors[0]} />
                <stop offset="100%" stopColor={gradientColors[1]} />
              </linearGradient>
            </defs>
          )}
          <motion.path
            d="M 2,15 Q 26,7 50,15 T 98,15"
            fill="none"
            stroke={gradientColors ? `url(#${gradientId})` : highlightColor}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pathLength: scaleX }}
          />
        </motion.svg>
      ) : variant === "dotted" ? (
        <motion.svg
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            pointerEvents: "none",
            overflow: "visible",
            height: `${highlightHeight * 100}%`,
            top: `${highlightY * 100}%`,
            width: "100%",
            zIndex: -1,
            opacity: finalDottedOpacity,
          }}
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
        >
          <defs>
            <clipPath id={clipId}>
              <motion.rect
                x="0"
                y="0"
                width={clipWidth}
                height="20"
              />
            </clipPath>
            {gradientColors && (
              <linearGradient id={gradientId} x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={gradientColors[0]} />
                <stop offset="100%" stopColor={gradientColors[1]} />
              </linearGradient>
            )}
          </defs>
          <path
            d="M 2,10 L 98,10"
            fill="none"
            stroke={gradientColors ? `url(#${gradientId})` : highlightColor}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="0 8"
            clipPath={`url(#${clipId})`}
          />
        </motion.svg>
      ) : (
        <motion.span
          aria-hidden="true"
          style={{
            ...solidBgStyle,
            position: "absolute",
            left: "-0.05em",
            right: "-0.25em",
            pointerEvents: "none",
            height: `${highlightHeight * hVar * 100}%`,
            top: `${highlightY * 100}%`,
            y: yShift,
            rotate: skewY,
            scaleX,
            transformOrigin: "left center",
            zIndex: -1,
            borderRadius,
            opacity: highlightOpacity,
            willChange: "transform",
          }}
        />
      )}

      {isDramatic ? (
        <span style={{ display: "inline-grid", gridTemplateColumns: "1fr", alignItems: "baseline" }}>
          <motion.span
            className={baseFontClass}
            aria-hidden="true"
            style={{
              gridArea: "1 / 1",
              whiteSpace: "nowrap",
              justifySelf: "start",
              textAlign: "left",
              opacity: opacityNormal,
              color: textColor,
            }}
          >
            {word}
          </motion.span>
          <motion.span
            className={dramaticFontClass}
            aria-hidden="true"
            style={{
              gridArea: "1 / 1",
              whiteSpace: "nowrap",
              justifySelf: "start",
              textAlign: "left",
              opacity: opacityActive,
              color: activeTextColor,
            }}
          >
            {word}
          </motion.span>
        </span>
      ) : (
        word
      )}
    </motion.span>
  );
});

export default function ScrollHighlighter({
  text,
  sticky = false,
  fullscreen = false,
  scrollSpeed = 0.001,
  customProgress,
  offset = ["start 0.85", "end 0.35"],
  textColor = "#646973",
  activeTextColor = "#FFFFFF",
  baseFontOpacity = 1.0,
  activeFont = "default",
  baseFontClass = "",
  dramaticFontClass = "font-cormorant italic",
  variant = "solid",
  highlightColor,
  gradientColors,
  highlightOpacity = 1.0,
  highlightHeight,
  highlightY,
  overlap = 1.5,
  smooth = true,
  physicsProfile = "gentle",
  springConfig,
  hoverGlow = true,
  className = "",
}: ScrollHighlighterProps): React.ReactNode {
  const [textElement, setTextElement] = useState<HTMLParagraphElement | null>(null);
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(null);
  const instanceId = useId();
  const [mounted, setMounted] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Local progress value for sticky scroll-hijacking mode
  const localProgress = useMotionValue(0);

  // Viewport scroll progress for natural inline scroll mode
  const { scrollYProgress } = useScroll({
    target: textElement ? { current: textElement } : undefined,
    // Framer Motion's offset type is a complex template-literal union; the
    // runtime values are always valid offset strings passed by the consumer.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    offset: offset as any,
  });

  const activeProgress = customProgress ?? (sticky ? localProgress : scrollYProgress);

  const resolvedSpring = springConfig ?? PHYSICS_PROFILES[physicsProfile];
  const smoothProgress = useSpring(activeProgress, resolvedSpring);
  const progress = smooth && !shouldReduceMotion ? smoothProgress : activeProgress;

  useEffect(() => {
    const container = containerElement;
    if (!sticky || customProgress || !container) return;

    const speed = scrollSpeed;
    const touchSpeed = speed * 2.2;
    let touchStartY = 0;

    const handleWheel = (e: WheelEvent) => {
      const current = localProgress.get();
      const delta = e.deltaY;
      
      if (delta > 0) {
        if (current < 1) {
          e.preventDefault();
          localProgress.set(clamp01(current + delta * speed));
        }
      } else if (delta < 0) {
        if (current > 0) {
          e.preventDefault();
          localProgress.set(clamp01(current + delta * speed));
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const deltaY = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      const current = localProgress.get();
      
      if (deltaY > 0) {
        if (current < 1) {
          e.preventDefault();
          localProgress.set(clamp01(current + deltaY * touchSpeed));
        }
      } else if (deltaY < 0) {
        if (current > 0) {
          e.preventDefault();
          localProgress.set(clamp01(current + deltaY * touchSpeed));
        }
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, [sticky, scrollSpeed, localProgress, customProgress, containerElement]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!sticky || customProgress) return;
    const current = localProgress.get();
    const step = 0.04;
    
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Spacebar" || e.key === " ") {
      e.preventDefault();
      localProgress.set(clamp01(current + step));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      localProgress.set(clamp01(current - step));
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <p
        className={`text-center leading-relaxed ${baseFontClass} ${className}`.trim()}
        style={{ opacity: baseFontOpacity, color: textColor }}
        aria-label={text}
      >
        {text}
      </p>
    );
  }

  if (!text.trim()) return null;

  const words = text.split(" ");
  const isWavy = variant === "wavy";
  const isDotted = variant === "dotted";

  const finalHighlightHeight = highlightHeight ?? (isWavy ? 0.28 : isDotted ? 0.18 : 0.55);
  const finalHighlightY = highlightY ?? (isWavy ? 0.68 : isDotted ? 0.82 : 0.38);
  const finalHighlightColor = highlightColor ?? (isWavy || isDotted ? "#E0FE00" : "rgba(224, 254, 0, 0.2)");

  const paragraph = (
    <p
      ref={(node) => {
        setTextElement(node);
        if (sticky && !fullscreen) {
          setContainerElement(node);
        }
      }}
      className={`text-center leading-relaxed ${baseFontClass} ${className}`.trim()}
      aria-label={text}
      tabIndex={sticky && !customProgress ? 0 : undefined}
      onKeyDown={handleKeyDown}
      style={{ outline: "none" }}
    >
      {words.map((word, i) => (
        <React.Fragment key={i}>
          <Word
            word={word}
            index={i}
            total={words.length}
            instanceId={instanceId}
            progress={progress}
            highlightColor={finalHighlightColor}
            gradientColors={gradientColors}
            highlightOpacity={highlightOpacity}
            textColor={textColor}
            activeTextColor={activeTextColor}
            baseFontOpacity={baseFontOpacity}
            highlightHeight={finalHighlightHeight}
            highlightY={finalHighlightY}
            variant={variant}
            activeFont={activeFont}
            baseFontClass={baseFontClass}
            dramaticFontClass={dramaticFontClass}
            overlap={overlap}
            hoverGlow={hoverGlow}
            shouldReduceMotion={shouldReduceMotion || false}
          />
          {i < words.length - 1 && " "}
        </React.Fragment>
      ))}
    </p>
  );

  if (sticky && fullscreen) {
    return (
      <div
        ref={setContainerElement as any}
        tabIndex={customProgress ? undefined : 0}
        onKeyDown={handleKeyDown}
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          outline: "none",
        }}
      >
        <div style={{ width: "100%", display: "flex", justifyContent: "center", padding: "0 1rem" }}>
          {paragraph}
        </div>
      </div>
    );
  }

  return paragraph;
}
