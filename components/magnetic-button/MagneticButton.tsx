"use client";

import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import { MagneticButtonProps } from "./types";

export function MagneticButton({
  children,
  range = 80,
  actionArea = "self",
  strength = 0.3,
  className = "",
  ...props
}: MagneticButtonProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const onMouseMove = (event: MouseEvent) => {
      const { clientX, clientY } = event;
      const { left, top, width, height } = trigger.getBoundingClientRect();
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      
      const distanceX = clientX - centerX;
      const distanceY = clientY - centerY;
      const distance = Math.hypot(distanceX, distanceY);

      if (distance < range) {
        gsap.to(trigger, {
          x: distanceX * strength,
          y: distanceY * strength,
          duration: 0.3,
          ease: "power2.out",
        });
      } else {
        gsap.to(trigger, {
          x: 0,
          y: 0,
          duration: 0.3,
          ease: "power2.out",
        });
      }
    };

    const onMouseLeave = () => {
      gsap.to(trigger, {
        x: 0,
        y: 0,
        duration: 0.3,
        ease: "power2.out",
      });
    };

    const targetElement = actionArea === "parent" ? trigger.parentElement : trigger;
    if (targetElement) {
      targetElement.addEventListener("mousemove", onMouseMove as EventListener);
      targetElement.addEventListener("mouseleave", onMouseLeave);
    }

    return () => {
      if (targetElement) {
        targetElement.removeEventListener("mousemove", onMouseMove as EventListener);
        targetElement.removeEventListener("mouseleave", onMouseLeave);
      }
    };
  }, [range, actionArea, strength]);

  return (
    <button
      ref={triggerRef}
      className={`inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
