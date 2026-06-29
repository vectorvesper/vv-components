"use client";

import React, { useEffect, useId, useRef, useState } from "react";

export interface WarpedVideoTextProps {
  /** Masking text string (e.g. "CREATIVE") */
  text?: string;
  /** Shader effect mode */
  fx?: "liquid" | "prism" | "glitch" | "wave" | "melt" | "clean";
  /** CSS class for the font family (e.g. "font-sans", "font-montserrat") */
  font?: string;
  /** Looping background video path (required to reveal anything) */
  video?: string;
  /** Poster image shown before the video plays / if autoplay is blocked */
  poster?: string;
  /** How the video fills the clip — "cover" crops to fill, "contain" shows the whole frame (default: "cover") */
  videoFit?: "cover" | "contain" | "fill";
  /** Zoom on the video inside the clip. Lower reveals MORE of the frame; 1.0 = exact cover, >1 zooms in (default: 1.04) */
  videoScale?: number;
  /** Object-position of the video, e.g. "center", "top", "50% 30%" (default: "center") */
  videoPosition?: string;
  /** Reveals a band of video around the text at the card edges — higher = more bleed (px, default: 0) */
  bleed?: number;
  /** Controls play/pause of the background video */
  isPlaying?: boolean;
  /** Base frequency of noise (used by liquid/wave/melt shaders) */
  freq?: number;
  /** Multiplier scaling the strength of the speed-based distortions */
  damp?: number;
  /** Enables 3D perspective card tilt on mouse movement */
  enableTilt?: boolean;
  /** Max horizontal tilt in degrees */
  tiltMaxX?: number;
  /** Max vertical tilt in degrees */
  tiltMaxY?: number;
  /** Perspective distance for the 3D card effect (in pixels) */
  tiltPerspective?: number;
  /** Cursor lerp easing coefficient (0.01 – 0.2) */
  tiltLerp?: number;
  /** Base / outer width of the component in pixels — the outer clip rect (default: 1200) */
  width?: number;
  /** Base height of the component in pixels (default: 300) */
  height?: number;
  /** Inner mask width the text is fit within — the inner clip rect (default: width − 60) */
  innerWidth?: number;
  /** Font size of the masked text in SVG units at base width (default: 145) */
  fontSize?: number;
  /** Auto-compress text horizontally so it fits inside innerWidth (default: true) */
  fitText?: boolean;
  /** Assumed average glyph width as a fraction of fontSize, used for fit math.
   *  Tune per font — condensed ≈ 0.45, wide ≈ 0.7 (default: 0.55) */
  charWidthRatio?: number;
  /** Lower bound for horizontal text compression so it never squishes to nothing (default: 0.4) */
  minTextScaleX?: number;
  /** How far (in %) the distortion filter region extends beyond the box before clipping (default: 20) */
  filterMargin?: number;
  /** Clip distortions/tilt to the outer rect. Set false to let strong effects (melt/liquid) spill (default: true) */
  clipOverflow?: boolean;
  /** Extra classes for the outer container */
  className?: string;
  /** Inline style overrides for the outer container */
  style?: React.CSSProperties;
  /** Accessible label for the masked text (defaults to `text`) */
  "aria-label"?: string;
}

export default function WarpedVideoText({
  text = "CREATIVE",
  fx = "liquid",
  font = "font-sans",
  video = "",
  poster,
  videoFit = "cover",
  videoScale = 1.04,
  videoPosition = "center",
  bleed = 0,
  isPlaying = true,
  freq = 0.015,
  damp = 8,
  enableTilt = true,
  tiltMaxX = 12,
  tiltMaxY = 12,
  tiltPerspective = 1200,
  tiltLerp = 0.08,
  width = 1200,
  height = 300,
  innerWidth,
  fontSize = 145,
  fitText = true,
  charWidthRatio = 0.55,
  minTextScaleX = 0.4,
  filterMargin = 20,
  clipOverflow = true,
  className = "",
  style,
  "aria-label": ariaLabel,
}: WarpedVideoTextProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  // Element refs for direct DOM mutation (avoids React overhead at 120fps+).
  const videoWrapRef = useRef<HTMLDivElement>(null);
  const displacementMapRef = useRef<SVGFEDisplacementMapElement>(null);
  const prismRedRef = useRef<SVGFEOffsetElement>(null);
  const prismBlueRef = useRef<SVGFEOffsetElement>(null);
  const glitchMapRef = useRef<SVGFEDisplacementMapElement>(null);
  const waveMapRef = useRef<SVGFEDisplacementMapElement>(null);
  const meltMapRef = useRef<SVGFEDisplacementMapElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textGroupRef = useRef<SVGGElement>(null);

  // Unique ids per instance — multiple components on one page would otherwise
  // share global <filter>/<mask> ids and break every instance but the last.
  const rawId = useId();
  const uid = rawId.replace(/:/g, "");
  const ids = {
    liquid: `vv-ct-liquid-${uid}`,
    prism: `vv-ct-prism-${uid}`,
    glitch: `vv-ct-glitch-${uid}`,
    wave: `vv-ct-wave-${uid}`,
    melt: `vv-ct-melt-${uid}`,
    mask: `vv-ct-mask-${uid}`,
  };

  // Track the actual rendered size so SVG filter magnitudes scale responsively.
  const [dims, setDims] = useState({ w: width, h: height });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      setDims({
        w: container.clientWidth || width,
        h: container.clientHeight || height,
      });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);
    return () => observer.disconnect();
  }, [width, height]);

  // Sync props to refs so the rAF ticker reads the latest without re-subscribing.
  const fxRef = useRef(fx);
  const dampRef = useRef(damp);
  const enableTiltRef = useRef(enableTilt);
  const tiltMaxXRef = useRef(tiltMaxX);
  const tiltMaxYRef = useRef(tiltMaxY);
  const tiltPerspectiveRef = useRef(tiltPerspective);
  const tiltLerpRef = useRef(tiltLerp);
  const scaleRatioRef = useRef(1);
  const prefersReducedMotionRef = useRef(false);

  useEffect(() => { fxRef.current = fx; }, [fx]);
  useEffect(() => { dampRef.current = damp; }, [damp]);
  useEffect(() => { enableTiltRef.current = enableTilt; }, [enableTilt]);
  useEffect(() => { tiltMaxXRef.current = tiltMaxX; }, [tiltMaxX]);
  useEffect(() => { tiltMaxYRef.current = tiltMaxY; }, [tiltMaxY]);
  useEffect(() => { tiltPerspectiveRef.current = tiltPerspective; }, [tiltPerspective]);
  useEffect(() => { tiltLerpRef.current = tiltLerp; }, [tiltLerp]);
  useEffect(() => { scaleRatioRef.current = dims.w / width; }, [dims.w, width]);

  // Respect prefers-reduced-motion: disable cursor distortion + 3D tilt.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { prefersReducedMotionRef.current = mq.matches; };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Video playback sync.
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.play().catch(() => {});
    else videoRef.current.pause();
  }, [isPlaying, video]);

  // Performance-optimized requestAnimationFrame loop.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const speed = { current: 0, target: 0 };
    const lastMousePos = { x: 0, y: 0, time: 0 };

    const onMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { left, top, width: w, height: h } = container.getBoundingClientRect();
      mouse.targetX = (clientX - left) / w - 0.5;
      mouse.targetY = (clientY - top) / h - 0.5;

      const now = performance.now();
      const dt = now - lastMousePos.time || 1;
      const dx = clientX - lastMousePos.x;
      const dy = clientY - lastMousePos.y;
      speed.target = Math.sqrt(dx * dx + dy * dy) / dt;

      lastMousePos.x = clientX;
      lastMousePos.y = clientY;
      lastMousePos.time = now;
    };

    const onMouseLeave = () => {
      mouse.targetX = 0;
      mouse.targetY = 0;
      speed.target = 0;
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);

    let animationFrameId = 0;

    const tick = () => {
      const reduced = prefersReducedMotionRef.current;

      mouse.x += (mouse.targetX - mouse.x) * tiltLerpRef.current;
      mouse.y += (mouse.targetY - mouse.y) * tiltLerpRef.current;
      speed.current += (speed.target - speed.current) * 0.07;
      speed.target *= 0.94; // friction decay

      const dampValue = dampRef.current;
      const currentFX = fxRef.current;
      const scaleRatio = scaleRatioRef.current;

      // 1. Mutate SVG filter attributes directly (skipped under reduced motion).
      if (!reduced) {
        let dynamicWarp = 0;
        if (currentFX === "liquid") {
          dynamicWarp = Math.min(speed.current * (dampValue * 4.5), 70);
          displacementMapRef.current?.setAttribute("scale", (dynamicWarp * scaleRatio).toFixed(2));
        } else if (currentFX === "prism") {
          dynamicWarp = Math.min(speed.current * (dampValue * 1.8), 35);
          prismRedRef.current?.setAttribute("dx", (-dynamicWarp * mouse.x * scaleRatio).toFixed(2));
          prismRedRef.current?.setAttribute("dy", (-dynamicWarp * mouse.y * scaleRatio).toFixed(2));
          prismBlueRef.current?.setAttribute("dx", (dynamicWarp * mouse.x * scaleRatio).toFixed(2));
          prismBlueRef.current?.setAttribute("dy", (dynamicWarp * mouse.y * scaleRatio).toFixed(2));
        } else if (currentFX === "glitch") {
          dynamicWarp = Math.min(speed.current * (dampValue * 6), 90);
          glitchMapRef.current?.setAttribute("scale", (dynamicWarp * scaleRatio).toFixed(2));
        } else if (currentFX === "wave") {
          dynamicWarp = Math.min(speed.current * (dampValue * 3.5), 55);
          waveMapRef.current?.setAttribute("scale", (dynamicWarp * scaleRatio).toFixed(2));
        } else if (currentFX === "melt") {
          dynamicWarp = Math.min(speed.current * (dampValue * 5.0), 80);
          meltMapRef.current?.setAttribute("scale", (dynamicWarp * scaleRatio).toFixed(2));
        }
      }

      // 2. 3D parallax card tilt (off under reduced motion or when disabled).
      const tiltOn = enableTiltRef.current && !reduced;
      if (videoWrapRef.current) {
        if (tiltOn) {
          const rotateCardX = -mouse.y * tiltMaxYRef.current;
          const rotateCardY = mouse.x * tiltMaxXRef.current;
          videoWrapRef.current.style.transform = `perspective(${tiltPerspectiveRef.current}px) rotateX(${rotateCardX}deg) rotateY(${rotateCardY}deg)`;
        } else {
          videoWrapRef.current.style.transform = "none";
        }
      }

      // 3. Subtle sub-pixel offset on the text path.
      const tX = reduced ? 0 : mouse.x * 40 * scaleRatio;
      const tY = reduced ? 0 : mouse.y * 25 * scaleRatio;
      textGroupRef.current?.setAttribute("transform", `translate(${tX}, ${tY})`);

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const getFilterUrl = () => {
    switch (fx) {
      case "liquid": return `url(#${ids.liquid})`;
      case "prism": return `url(#${ids.prism})`;
      case "glitch": return `url(#${ids.glitch})`;
      case "wave": return `url(#${ids.wave})`;
      case "melt": return `url(#${ids.melt})`;
      default: return undefined; // "clean" → no distortion
    }
  };

  const containerStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: `${width}px`,
    aspectRatio: `${width} / ${height}`,
    ...style,
  };

  // Scale font + fit math by the actual measured width.
  const scaleRatio = dims.w / width;
  const scaledFontSize = fontSize * scaleRatio;
  // Inset of the mask's black backdrop — the band of video revealed at the edges.
  const bleedPx = bleed * scaleRatio;

  // Inner clip rect: the width the text must fit within (defaults to width − 60).
  const resolvedInnerWidth = innerWidth ?? width - 60;
  const actualInnerWidth = resolvedInnerWidth * scaleRatio;

  // Horizontal compression to fit long text inside innerWidth. charWidthRatio
  // approximates average glyph width as a fraction of font-size (font-dependent).
  const approxTextWidth = text.length * scaledFontSize * charWidthRatio;
  let textScaleX = 1;
  if (fitText && approxTextWidth > actualInnerWidth && approxTextWidth > 0) {
    textScaleX = Math.max(minTextScaleX, actualInnerWidth / approxTextWidth);
  }

  // Distortion filter region — extends `filterMargin`% beyond the box edges.
  const fm = filterMargin;
  const region = {
    x: `-${fm}%`,
    y: `-${fm}%`,
    width: `${100 + fm * 2}%`,
    height: `${100 + fm * 2}%`,
  };

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel ?? text}
      className={`relative flex items-center justify-center select-none ${clipOverflow ? "overflow-hidden" : "overflow-visible"} ${className}`}
      style={containerStyle}
    >
      {/* SVG defs: distortion filters + text mask (no visual output itself). */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Liquid: organic fluid turbulence */}
          <filter id={ids.liquid} x={region.x} y={region.y} width={region.width} height={region.height}>
            <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="3" result="noise" />
            <feDisplacementMap ref={displacementMapRef} in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" />
          </filter>

          {/* Prism: RGB chromatic aberration */}
          <filter id={ids.prism} x={region.x} y={region.y} width={region.width} height={region.height}>
            <feOffset in="SourceGraphic" dx="0" dy="0" result="red" ref={prismRedRef} />
            <feOffset in="SourceGraphic" dx="0" dy="0" result="blue" ref={prismBlueRef} />
            <feColorMatrix in="red" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="redChan" />
            <feColorMatrix in="blue" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blueChan" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="greenChan" />
            <feBlend mode="screen" in="redChan" in2="blueChan" result="redblue" />
            <feBlend mode="screen" in="redblue" in2="greenChan" />
          </filter>

          {/* Glitch: high-frequency scanline offsets */}
          <filter id={ids.glitch} x={region.x} y={region.y} width={region.width} height={region.height}>
            <feTurbulence type="fractalNoise" baseFrequency="0.002 0.85" numOctaves="1" result="glitchNoise" />
            <feDisplacementMap ref={glitchMapRef} in="SourceGraphic" in2="glitchNoise" scale="0" xChannelSelector="R" yChannelSelector="G" />
          </filter>

          {/* Wave: horizontal ripple */}
          <filter id={ids.wave} x={region.x} y={region.y} width={region.width} height={region.height}>
            <feTurbulence type="fractalNoise" baseFrequency={`${freq} 0.1`} numOctaves="2" result="waveNoise" />
            <feDisplacementMap ref={waveMapRef} in="SourceGraphic" in2="waveNoise" scale="0" xChannelSelector="R" yChannelSelector="G" />
          </filter>

          {/* Melt: vertical drip */}
          <filter id={ids.melt} x={region.x} y={region.y} width={region.width} height={region.height}>
            <feTurbulence type="fractalNoise" baseFrequency={`0.1 ${freq}`} numOctaves="2" result="meltNoise" />
            <feDisplacementMap ref={meltMapRef} in="SourceGraphic" in2="meltNoise" scale="0" xChannelSelector="G" yChannelSelector="R" />
          </filter>

          {/* Text mask — white text reveals the video, black hides it */}
          <mask id={ids.mask} x="0" y="0" width="100%" height="100%">
            <rect
              x={bleedPx}
              y={bleedPx}
              width={Math.max(0, dims.w - bleedPx * 2)}
              height={Math.max(0, dims.h - bleedPx * 2)}
              fill="black"
            />
            <g ref={textGroupRef}>
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={scaledFontSize}
                className={`${font} font-black uppercase tracking-tighter`}
                transform={`translate(${dims.w / 2}, ${dims.h / 2}) scale(${textScaleX}, 1) translate(${-dims.w / 2}, ${-dims.h / 2})`}
                filter={getFilterUrl()}
              >
                {text}
              </text>
            </g>
          </mask>
        </defs>
      </svg>

      {/* Foreground: clipped looping video revealed through the text mask */}
      <div
        ref={videoWrapRef}
        aria-hidden="true"
        className="w-full h-full relative transition-transform"
        style={{
          maskImage: `url(#${ids.mask})`,
          WebkitMaskImage: `url(#${ids.mask})`,
        }}
      >
        <video
          key={video}
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          poster={poster}
          className="w-full h-full brightness-[1.18] contrast-[1.1] saturate-[1.12]"
          style={{
            objectFit: videoFit,
            objectPosition: videoPosition,
            transform: `scale(${videoScale})`,
          }}
        >
          {video && <source src={video} type="video/mp4" />}
        </video>
      </div>
    </div>
  );
}
