"use client";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";

export type SmoothTickerProps = {
  direction?: 1 | -1;
  images: string[];
  onCardClick?: (src: string) => void;
  cardWidth?: number;
  cardHeight?: number;
  gap?: number;
  speed?: number;
  cardBorderRadius?: number;
  containerBorderRadius?: number;
  containerHeight?: number;
  containerBackground?: string;
  pauseOnHover?: boolean;
  showHoverGlow?: boolean;
  showShineSweep?: boolean;
  showGradientBorder?: boolean;
  cardBackground?: string;
  className?: string;
};

const borderVariants = {
  rest: { opacity: 0 },
  hover: { opacity: 1 },
};

const imageVariants = {
  rest: {
    scale: 1,
    filter: "brightness(0.7) saturate(0.8)",
  },
  hover: {
    scale: 1.06,
    filter: "brightness(0.95) saturate(1.05)",
  },
};

const shineVariants = {
  rest: { x: "-100%", opacity: 0 },
  hover: { x: "200%", opacity: 0.08 },
};

const SmoothTicker = ({
  direction = 1,
  images,
  onCardClick,
  cardWidth: cardW = 170,
  cardHeight = 200,
  gap = 20,
  speed = 0.05,
  cardBorderRadius = 14,
  containerBorderRadius = 30,
  containerHeight = 230,
  containerBackground = "#060608",
  pauseOnHover = true,
  showHoverGlow = true,
  showShineSweep = true,
  showGradientBorder = true,
  cardBackground = "#0a0a0e",
  className,
}: SmoothTickerProps): React.JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const documentVisibleRef = useRef(true);
  const prefersReducedMotion = useReducedMotion();
  const [containerWidth, setContainerWidth] = useState(0);

  const cycleWidth = (cardW + gap) * images.length;
  const repeatCount = useMemo(() => {
    if (!cycleWidth) return 2;
    return Math.max(2, Math.ceil(containerWidth / cycleWidth) + 2);
  }, [containerWidth, cycleWidth]);

  const displayImages = useMemo(
    () =>
      Array.from({ length: repeatCount }, (_, repeatIndex) =>
        images.map((src, imageIndex) => ({
          src,
          key: `${repeatIndex}-${imageIndex}-${src}`,
        }))
      ).flat(),
    [images, repeatCount]
  );
  const eagerImageCount = images.length * 2;

  const x = useMotionValue(direction === 1 ? -cycleWidth : 0);

  useEffect(() => {
    x.set(direction === 1 ? -cycleWidth : 0);
  }, [cycleWidth, direction, x]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      setContainerWidth(container.getBoundingClientRect().width);
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => {
        window.removeEventListener("resize", measure);
      };
    }

    const observer = new ResizeObserver(() => {
      measure();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      documentVisibleRef.current = document.visibilityState === "visible";
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useAnimationFrame((_t, delta) => {
    if (
      prefersReducedMotion ||
      pausedRef.current ||
      !documentVisibleRef.current ||
      cycleWidth <= 0
    ) {
      return;
    }

    const prev = x.get();
    let next = prev + direction * delta * speed;

    if (direction === -1 && next <= -cycleWidth) {
      next += cycleWidth;
    } else if (direction === 1 && next >= 0) {
      next -= cycleWidth;
    }

    x.set(next);
  });

  return (
    <div
      className={className}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <div
        ref={containerRef}
        onPointerEnter={() => {
          if (pauseOnHover) pausedRef.current = true;
        }}
        onPointerLeave={() => {
          pausedRef.current = false;
        }}
        style={{
          width: "250vw",
          height: `${containerHeight}px`,
          borderRadius: `${containerBorderRadius}px`,
          background: containerBackground,
          border: "1px solid rgba(255, 255, 255, 0.03)",
          boxShadow: `
            6px 6px 16px rgba(0, 0, 0, 0.7),
            -2px -2px 10px rgba(255, 255, 255, 0.02),
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            inset 0 -1px 0 rgba(0, 0, 0, 0.4)
          `,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          padding: "0.75rem",
          position: "relative",
          backfaceVisibility: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "80px",
            background: `linear-gradient(to right, ${containerBackground}, transparent)`,
            zIndex: 5,
            pointerEvents: "none",
            borderRadius: `${containerBorderRadius}px 0 0 ${containerBorderRadius}px`,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "80px",
            background: `linear-gradient(to left, ${containerBackground}, transparent)`,
            zIndex: 5,
            pointerEvents: "none",
            borderRadius: `0 ${containerBorderRadius}px ${containerBorderRadius}px 0`,
          }}
        />

        <motion.div
          style={{
            display: "flex",
            gap: `${gap}px`,
            x,
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >
          {displayImages.map(({ src, key }, index) => (
            <motion.div
              key={key}
              style={{
                width: `${cardW}px`,
                height: `${cardHeight}px`,
                borderRadius: `${cardBorderRadius}px`,
                position: "relative",
                overflow: "hidden",
                cursor: onCardClick ? "pointer" : "default",
                flexShrink: 0,
                background: cardBackground,
                boxShadow: `
                  4px 4px 12px rgba(0, 0, 0, 0.6),
                  -2px -2px 8px rgba(255, 255, 255, 0.015),
                  inset 0 1px 0 rgba(255, 255, 255, 0.04)
                `,
                contain: "paint",
              }}
              onClick={() => onCardClick?.(src)}
              whileHover="hover"
              initial="rest"
              animate="rest"
            >
              {showGradientBorder && (
                <motion.div
                  variants={borderVariants}
                  transition={{ duration: 0.35 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: `${cardBorderRadius}px`,
                    padding: "1.5px",
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05), rgba(255,255,255,0.12))",
                    WebkitMask:
                      "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                />
              )}

              <motion.img
                src={src}
                alt={`card-${index % Math.max(images.length, 1)}`}
                draggable={false}
                loading={index < eagerImageCount ? "eager" : "lazy"}
                decoding="async"
                variants={imageVariants}
                transition={{ duration: 0.45, ease: "easeOut" }}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: `${cardBorderRadius}px`,
                  display: "block",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "40%",
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.5), transparent)",
                  borderRadius: `0 0 ${cardBorderRadius}px ${cardBorderRadius}px`,
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />

              {showHoverGlow && (
                <motion.div
                  variants={borderVariants}
                  transition={{ duration: 0.4 }}
                  style={{
                    position: "absolute",
                    inset: "-1px",
                    borderRadius: `${cardBorderRadius + 1}px`,
                    boxShadow:
                      "0 0 20px rgba(255,255,255,0.04), 0 0 40px rgba(127,140,255,0.03)",
                    pointerEvents: "none",
                    zIndex: 0,
                  }}
                />
              )}

              {showShineSweep && (
                <motion.div
                  variants={shineVariants}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "50%",
                    height: "100%",
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
                    pointerEvents: "none",
                    zIndex: 3,
                  }}
                />
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default SmoothTicker;
