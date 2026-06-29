"use client";
import { motion, AnimatePresence } from "framer-motion";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type LightboxOverlayProps = {
  src: string | null;
  onClose: () => void;
  imageWidth?: string;
  imageHeight?: string;
  borderRadius?: string;
  backdropBlur?: string;
  overlayColor?: string;
  closeHintText?: string;
  showCloseHint?: boolean;
  showAmbientGlow?: boolean;
  className?: string;
};

const LightboxOverlay = ({
  src,
  onClose,
  imageWidth = "420px",
  imageHeight = "540px",
  borderRadius = "24px",
  backdropBlur = "24px",
  overlayColor = "rgba(3,3,3,0.8)",
  closeHintText = "Click anywhere to close",
  showCloseHint = true,
  showAmbientGlow = true,
  className,
}: LightboxOverlayProps): React.ReactNode => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (src) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [src]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          className={className}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backdropFilter: `blur(${backdropBlur}) saturate(0.4)`,
            WebkitBackdropFilter: `blur(${backdropBlur}) saturate(0.4)`,
            backgroundColor: overlayColor,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            cursor: "pointer",
            gap: "1.5rem",
          }}
        >
          {showAmbientGlow && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{
                position: "absolute",
                width: "480px",
                height: "580px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
                filter: "blur(60px)",
                pointerEvents: "none",
              }}
            />
          )}

          <motion.div
            style={{
              position: "relative",
              borderRadius,
              overflow: "hidden",
            }}
            initial={{ scale: 0.7, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius,
                padding: "1.5px",
                background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03), rgba(255,255,255,0.08))",
                WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                pointerEvents: "none",
                zIndex: 2,
              }}
            />

            <img
              src={src}
              alt="Enlarged preview"
              draggable={false}
              decoding="async"
              style={{
                width: imageWidth,
                height: imageHeight,
                objectFit: "cover",
                borderRadius,
                display: "block",
                boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 60px rgba(255,255,255,0.02)",
              }}
            />
          </motion.div>

          {showCloseHint && (
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              style={{
                fontSize: "0.65rem",
                color: "rgba(200,200,220,0.3)",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontFamily: "'Inter', sans-serif",
                userSelect: "none",
              }}
            >
              {closeHintText}
            </motion.span>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default LightboxOverlay;
