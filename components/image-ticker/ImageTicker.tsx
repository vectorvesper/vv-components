"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import LightboxOverlay from "./LightboxOverlay";
import SmoothTicker from "./SmoothTicker";

import type { LightboxOverlayProps } from "./LightboxOverlay";
import type { SmoothTickerProps } from "./SmoothTicker";

export type ImageTickerProps = {
  topImages: string[];
  bottomImages: string[];
  topRotation?: number;
  bottomRotation?: number;
  backgroundColor?: string;
  height?: string;
  title?: string;
  titleFontFamily?: string;
  titleFontSize?: string;
  titleColor?: string;
  titlePosition?: "left" | "right" | "center";
  titleOffset?: string;
  showAmbientGlow?: boolean;
  ambientGlowColor?: string;
  showNoiseGrain?: boolean;
  showVignette?: boolean;
  enableLightbox?: boolean;
  onImageClick?: (src: string) => void;
  tickerProps?: Partial<
    Omit<SmoothTickerProps, "images" | "direction" | "onCardClick">
  >;
  lightboxProps?: Partial<Omit<LightboxOverlayProps, "src" | "onClose">>;
  className?: string;
};

const ImageTicker = ({
  topImages,
  bottomImages,
  topRotation = 35,
  bottomRotation = -35,
  backgroundColor = "#030303",
  height = "100vh",
  title,
  titleFontFamily = "'Bebas Neue', sans-serif",
  titleFontSize = "clamp(2rem, 4vw, 6rem)",
  titleColor = "rgba(255, 255, 255, 0.95)",
  titlePosition = "right",
  titleOffset = "8vw",
  showAmbientGlow = true,
  ambientGlowColor = "rgba(127,140,255,0.06)",
  showNoiseGrain = true,
  showVignette = true,
  enableLightbox = true,
  onImageClick,
  tickerProps = {},
  lightboxProps = {},
  className,
}: ImageTickerProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleCardClick = (src: string) => {
    onImageClick?.(src);
    if (enableLightbox) {
      setSelectedImage(src);
    }
  };

  const titleAlignMap = {
    left: {
      right: undefined,
      left: titleOffset,
      alignItems: "flex-start",
      textAlign: "left" as const,
    },
    right: {
      right: titleOffset,
      left: undefined,
      alignItems: "flex-end",
      textAlign: "right" as const,
    },
    center: {
      right: undefined,
      left: "50%",
      alignItems: "center",
      textAlign: "center" as const,
    },
  };
  const titleAlign = titleAlignMap[titlePosition];

  return (
    <>
      <div
        className={className}
        style={{
          background: backgroundColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height,
          overflow: "hidden",
          width: "100vw",
          position: "relative",
        }}
      >
        {showAmbientGlow && (
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              top: "20%",
              left: "10%",
              width: "400px",
              height: "400px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${ambientGlowColor} 0%, transparent 70%)`,
              filter: "blur(80px)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}

        {showNoiseGrain && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
              backgroundRepeat: "repeat",
              pointerEvents: "none",
              zIndex: 1,
              opacity: 0.35,
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "5px",
            zIndex: 2,
          }}
        >
          <div
            style={{
              transform: `rotate(${topRotation}deg)`,
              transformOrigin: "center center",
              width: "250vw",
              marginLeft: "-75vw",
              marginTop: "-5vh",
              backfaceVisibility: "hidden",
            }}
          >
            <SmoothTicker
              direction={1}
              images={topImages}
              onCardClick={handleCardClick}
              {...tickerProps}
            />
          </div>

          <div
            style={{
              transform: `rotate(${bottomRotation}deg)`,
              transformOrigin: "center center",
              width: "250vw",
              marginLeft: "-75vw",
              marginBottom: "-5vh",
              backfaceVisibility: "hidden",
            }}
          >
            <SmoothTicker
              direction={-1}
              images={bottomImages}
              onCardClick={handleCardClick}
              {...tickerProps}
            />
          </div>
        </div>

        {title && (
          <motion.div
            initial={{ opacity: 0, x: titlePosition === "left" ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
            style={{
              position: "absolute",
              right: titleAlign.right,
              left: titleAlign.left,
              transform:
                titlePosition === "center" ? "translateX(-50%)" : undefined,
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: titleAlign.alignItems,
              textAlign: titleAlign.textAlign,
            }}
          >
            <h1
              style={{
                fontSize: titleFontSize,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                textTransform: "uppercase",
                color: titleColor,
                fontFamily: titleFontFamily,
                userSelect: "none",
                pointerEvents: "none",
                margin: 0,
                lineHeight: 1,
              }}
            >
              {title}
            </h1>
          </motion.div>
        )}

        {showVignette && (
          <>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "120px",
                background: `linear-gradient(to bottom, ${backgroundColor}, transparent)`,
                pointerEvents: "none",
                zIndex: 3,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "120px",
                background: `linear-gradient(to top, ${backgroundColor}, transparent)`,
                pointerEvents: "none",
                zIndex: 3,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: "100px",
                background: `linear-gradient(to right, ${backgroundColor}, transparent)`,
                pointerEvents: "none",
                zIndex: 3,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                right: 0,
                width: "100px",
                background: `linear-gradient(to left, ${backgroundColor}, transparent)`,
                pointerEvents: "none",
                zIndex: 3,
              }}
            />
          </>
        )}
      </div>

      {enableLightbox && (
        <LightboxOverlay
          src={selectedImage}
          onClose={() => setSelectedImage(null)}
          {...lightboxProps}
        />
      )}
    </>
  );
};

export default ImageTicker;
