"use client";

import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import { MagneticCursorProps } from "./types";

export function MagneticCursor({
  children,
  range = 100,
  strength = 0.5,
  className = "",
  ...props
}: MagneticCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    // Center the custom cursor element on the mouse pointer
    gsap.set(cursor, { xPercent: -50, yPercent: -50 });

    const onMouseMove = (event: MouseEvent) => {
      const { clientX, clientY } = event;
      
      // Move custom cursor to mouse position smoothly
      gsap.to(cursor, {
        x: clientX,
        y: clientY,
        duration: 0.2,
        ease: "power2.out",
      });
    };

    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      className={`fixed top-0 left-0 w-8 h-8 rounded-full border-2 border-indigo-600 pointer-events-none z-50 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
