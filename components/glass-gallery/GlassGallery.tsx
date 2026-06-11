"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, useProgress } from "@react-three/drei";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Scene from "./Scene";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export interface GlassGalleryProps {
  images?: string[];
  mode?: "square" | "rect" | "quad";
  cubeSize?: number;
  autoSpinSpeed?: number;
  scrollSpins?: number;
  mouseTiltIntensity?: number;
  backgroundColor?: string;
  hoverTransparency?: boolean;
  photoOpacity?: number;
  galleryItemWidth?: number;
  galleryItemHeight?: number;
  gridGapX?: number;
  gridGapY?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  staticPreview?: boolean;
}

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=600&q=80",
];

export default function GlassGallery({
  images,
  mode = "quad",
  cubeSize = 0.5,
  autoSpinSpeed = 0.15,
  scrollSpins = 1.0,
  mouseTiltIntensity = 1.0,
  backgroundColor = "#000000",
  hoverTransparency = false,
  photoOpacity = 1.0,
  galleryItemWidth,
  galleryItemHeight,
  gridGapX,
  gridGapY,
  className = "",
  style,
  children,
  staticPreview = false,
}: GlassGalleryProps) {
  const [mounted, setMounted] = useState(false);
  const pinRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0.0);
  const { active } = useProgress();

  const imageUrls = useMemo(() => {
    const src = images && images.length > 0 ? images : DEFAULT_IMAGES;
    const faceCount = mode === "square" ? 6 : mode === "rect" ? 12 : 24;
    return Array.from({ length: faceCount }, (_, i) => src[i % src.length]);
  }, [images, mode]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = pinRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", handler, { capture: true });
    return () => el.removeEventListener("wheel", handler, { capture: true });
  }, [mounted]);

  const { scrollDepth, unfoldEnd } = useMemo(() => {
    const rows = mode === "quad" ? 3 : 2;
    const itemH = galleryItemHeight ?? (mode === "square" ? 2.8 : 1.37) * cubeSize;
    const gY = gridGapY ?? (mode === "rect" ? 0.13 : 0.12) * cubeSize;
    const gridH = rows * itemH + (rows - 1) * gY;
    const visualH = gridH * 0.55;
    const vpH = 5.467;
    const overflow = Math.max(0, visualH - vpH);

    if (overflow <= 0) return { scrollDepth: "100%", unfoldEnd: 1.0 };
    const pct = overflow / vpH;
    const depth = 100 + pct * 100;
    return { scrollDepth: `${depth}%`, unfoldEnd: 100 / depth };
  }, [mode, cubeSize, galleryItemHeight, gridGapY]);

  useGSAP(() => {
    if (staticPreview) return;
    const root = pinRef.current;
    if (!root) return;

    const scrollHintEl = root.querySelector<HTMLElement>("[data-glass-gallery-scroll-hint]");
    const headlineEl = root.querySelector<HTMLElement>("[data-glass-gallery-headline], #glass-gallery-headline");
    const bottomEl = root.querySelector<HTMLElement>("[data-glass-gallery-bottom-overlay], #glass-gallery-bottom-overlay");

    const trigger = ScrollTrigger.create({
      trigger: root,
      start: "top top",
      end: `+=${scrollDepth}`,
      pin: true,
      pinSpacing: true,
      scrub: 0.8,
      onUpdate: (self) => {
        if ((ScrollTrigger as any).isRefreshing) return;
        const progress = (typeof window !== "undefined" && window.scrollY === 0) ? 0.0 : self.progress;
        scrollProgressRef.current = progress;
        
        if (scrollHintEl) scrollHintEl.style.opacity = Math.max(0, 1 - progress * 4.5).toString();

        if (headlineEl) {
          const threshold = unfoldEnd * 0.8;
          const factor = Math.min(1.0, progress / Math.max(0.001, threshold));
          const ease = Math.sin((factor * Math.PI) / 2);
          
          const opacity = 1.0 - ease;
          const scale = 1.0 - ease * 0.1;
          const translateY = -ease * 60;
          const blurVal = ease * 8;
          
          headlineEl.style.opacity = opacity.toString();
          headlineEl.style.transform = `translateY(${translateY}px) scale(${scale})`;
          headlineEl.style.filter = `blur(${blurVal}px)`;
          headlineEl.style.pointerEvents = opacity < 0.1 ? "none" : "auto";
          headlineEl.style.zIndex = opacity < 0.15 ? "0" : "10";
        }

        if (bottomEl) {
          const threshold = unfoldEnd * 0.7;
          const factor = Math.min(1.0, progress / Math.max(0.001, threshold));
          const ease = Math.sin((factor * Math.PI) / 2);
          
          const opacity = 1.0 - ease;
          const translateY = ease * 40;
          
          bottomEl.style.opacity = opacity.toString();
          bottomEl.style.transform = `translateY(${translateY}px)`;
          bottomEl.style.pointerEvents = opacity < 0.1 ? "none" : "auto";
        }
      },
    });
    return () => trigger.kill();
  }, { scope: pinRef, dependencies: [mounted, scrollDepth, unfoldEnd, staticPreview], revertOnUpdate: true });

  if (!mounted) {
    return (
      <div 
        className="w-full h-screen flex items-center justify-center" 
        style={{ background: backgroundColor }}
      >
        <div className="w-8 h-8 rounded-full border border-neutral-800 border-t-neutral-400 animate-spin" />
      </div>
    );
  }

  return (
    <div
      ref={pinRef}
      className={`w-full ${staticPreview ? "h-full" : "h-screen"} select-none relative overflow-hidden ${className}`}
      style={{ backgroundColor, ...style }}
    >
      {active && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-50" 
          style={{ backgroundColor }}
        >
          <div className="w-12 h-12 border-4 border-neutral-800 border-t-neutral-400 rounded-full animate-spin" />
          <p className="text-neutral-400 text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse">
            Configuring 3D Engine...
          </p>
        </div>
      )}

      <Canvas
        camera={{ position: [0, 0, 6.6], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          if (process.env.NODE_ENV === "production") {
            gl.debug.checkShaderErrors = false;
          }
        }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", outline: "none" }}
      >
        <Suspense fallback={null}>
          <Environment preset="studio" />
          <ambientLight intensity={0.35} />
          <Scene
            imageUrls={imageUrls}
            scrollProgressRef={scrollProgressRef}
            mode={mode}
            cubeSize={cubeSize}
            autoSpinSpeed={autoSpinSpeed}
            scrollSpins={scrollSpins}
            mouseTiltIntensity={mouseTiltIntensity}
            lerpSpeed={0.12}
            rotationLerpSpeed={0.08}
            scaleLerpSpeed={0.12}
            hoverTransparency={hoverTransparency}
            photoOpacity={photoOpacity}
            galleryItemWidth={galleryItemWidth}
            galleryItemHeight={galleryItemHeight}
            gridGapX={gridGapX}
            gridGapY={gridGapY}
            unfoldEnd={unfoldEnd}
          />
        </Suspense>
      </Canvas>

      <div className="absolute inset-0 z-10 pointer-events-none">
        {children}
      </div>

      {!staticPreview && (
        <div
          data-glass-gallery-scroll-hint=""
          className="absolute bottom-10 right-10 z-20 flex flex-col items-center gap-3 pointer-events-none text-neutral-500 font-mono text-[9px] uppercase tracking-[0.4em]"
        >
          <span className="animate-pulse">Scroll to Disintegrate</span>
          <div className="w-px h-10 bg-neutral-800 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1/2 bg-white animate-bounce [animation-duration:2s]" />
          </div>
        </div>
      )}
    </div>
  );
}
