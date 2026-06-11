"use client";

import React from "react";

export default function GlassGalleryOverlay() {
  return (
    <div className="absolute mt-2 inset-0 flex flex-col items-center justify-between p-8 md:p-12 text-white pointer-events-none">
      <div className="w-full flex justify-between items-center mt-2"/>
      
      <div className="flex items-center justify-center gap-8 lg:gap-16 w-full max-w-7xl px-4 mt-8 select-none pointer-events-none">
        <div
          data-glass-gallery-headline=""
          className="relative z-10 flex flex-col items-center gap-8 md:gap-10 text-center pointer-events-none origin-center transform-gpu will-change-[opacity,transform,filter]"
        >
          <h1 
            className="flex flex-col gap-7 md:gap-9 lg:gap-11 text-5xl sm:text-7xl md:text-8xl lg:text-[7.5rem] xl:text-[8.25rem] font-bold leading-[0.82] uppercase text-[#c52e00] tracking-[-0.02em] filter drop-shadow-2xl"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <span className="block pointer-events-none">THE PROCESS</span>
            <span className="block text-transparent [-webkit-text-stroke:2.25px_#c52e00] opacity-95 pointer-events-none">
              BECOMES
            </span>
            <span className="block pointer-events-none">THE ART</span>
          </h1>
          <p className="font-mono pointer-events-none text-[9px] tracking-[0.4em] uppercase text-neutral-400 leading-relaxed max-w-sm text-center">
            A high-fidelity glass-morphic visual.
          </p>
        </div>
      </div>

      <div
        data-glass-gallery-bottom-overlay=""
        className="w-full flex flex-col md:flex-row justify-between items-stretch md:items-end gap-6 pointer-events-auto origin-bottom"
      />
    </div>
  );
}
