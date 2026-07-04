"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

function hexToRgb(hex: string) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "126, 172, 181";
}

export interface VideoCardProps {
  /** Video source URL (required). */
  src: string;
  /** Poster image shown before the video loads. */
  poster?: string;
  /** Autoplay the video — muted autoplay is allowed by browsers (default: true). */
  autoPlay?: boolean;
  /** Loop the video (default: true). */
  loop?: boolean;
  /** Start muted (default: true). */
  muted?: boolean;
  /** 3D perspective tilt on hover (default: true). */
  enableTilt?: boolean;
  /** Max tilt in degrees (default: 12). */
  tiltMax?: number;
  /** Show the bottom control dock — play / mute / volume / seek (default: true). */
  showControls?: boolean;
  /** Number of segments in the seek bar (default: 24). */
  segments?: number;
  /** Extra classes for the card container. */
  className?: string;
  /** Inline style overrides for the card container. */
  style?: React.CSSProperties;
  /** Accessible label for the player (default: "Video player"). */
  "aria-label"?: string;
  /** Accent color for HUD markers, glow, seek and volume highlights (default: "#7EACB5"). */
  accentColor?: string;
  /** Background color of the card container (default: "rgba(0,0,0,0.4)"). */
  cardBgColor?: string;
}

export default function VideoCard({
  src,
  poster,
  autoPlay = true,
  loop = true,
  muted = true,
  enableTilt = true,
  tiltMax = 12,
  showControls = true,
  segments = 24,
  className = "",
  style,
  "aria-label": ariaLabel = "Video player",
  accentColor = "#7EACB5",
  cardBgColor = "rgba(0, 0, 0, 0.4)",
}: VideoCardProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(0.8);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const reduceMotion = useReducedMotion();
  const tiltOn = enableTilt && !reduceMotion;

  const localMouseX = useMotionValue(0);
  const localMouseY = useMotionValue(0);
  const tiltX = useSpring(localMouseY, { stiffness: 200, damping: 30, mass: 0.5 });
  const tiltY = useSpring(localMouseX, { stiffness: 200, damping: 30, mass: 0.5 });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsPlaying(!video.paused);
    setIsMuted(video.muted);
    video.volume = volume;

    const updateProgress = () => {
      setCurrentTime(video.currentTime);
      setProgress((video.currentTime / (video.duration || 1)) * 100);
    };
    const handleDuration = () => setDuration(video.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolume = () => {
      setIsMuted(video.muted);
      if (!video.muted) setVolume(video.volume);
    };

    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("durationchange", handleDuration);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("volumechange", handleVolume);
    if (video.duration) setDuration(video.duration);

    return () => {
      video.removeEventListener("timeupdate", updateProgress);
      video.removeEventListener("durationchange", handleDuration);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("volumechange", handleVolume);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) video.pause();
    else video.play().catch(() => {});
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) video.volume = volume;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVol;
    const nextMuted = newVol === 0;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const seekToClientX = (clientX: number, rect: DOMRect) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = pct * duration;
  };

  const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    seekToClientX(e.clientX, e.currentTarget.getBoundingClientRect());
  };

  const handleSeekKey = (e: React.KeyboardEvent) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      video.currentTime = Math.min(duration, video.currentTime + duration * 0.05);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      video.currentTime = Math.max(0, video.currentTime - duration * 0.05);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${ms.toString().padStart(2, "0")}`;
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tiltOn) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    localMouseX.set(-x * tiltMax);
    localMouseY.set(y * tiltMax);
  };

  const handleCardMouseLeave = () => {
    localMouseX.set(0);
    localMouseY.set(0);
  };

  const segs = Array.from({ length: Math.max(1, segments) });

  return (
    <motion.div
      role="group"
      aria-label={ariaLabel}
      whileHover={{ scale: 1.02, transition: { duration: 0.3, ease: "easeOut" } }}
      style={{
        transformPerspective: 1500,
        rotateX: tiltOn ? tiltX : 0,
        rotateY: tiltOn ? tiltY : 0,
        transformStyle: "preserve-3d",
        willChange: "transform",
        "--accent-color": accentColor,
        "--accent-rgb": hexToRgb(accentColor),
        backgroundColor: cardBgColor,
        ...style,
      } as React.CSSProperties}
      onMouseMove={handleCardMouseMove}
      onMouseLeave={handleCardMouseLeave}
      onClick={() => togglePlay()}
      className={`relative w-full max-w-md rounded-3xl p-2.5 flex flex-col gap-2.5 cursor-pointer group shadow-[0_45px_95px_rgba(0,0,0,0.7)] backdrop-blur-3xl border border-white/10 hover:border-[rgba(var(--accent-rgb),0.3)] transition-[border-color,background-color,box-shadow] duration-300 ${className}`}
    >
      <div className="absolute top-0 left-0 w-5 h-5 border-t border-l border-[var(--accent-color)] rounded-tl-lg transition-transform duration-300 group-hover:-translate-x-1.5 group-hover:-translate-y-1.5 pointer-events-none z-30" />
      <div className="absolute top-0 right-0 w-5 h-5 border-t border-r border-[var(--accent-color)] rounded-tr-lg transition-transform duration-300 group-hover:translate-x-1.5 group-hover:-translate-y-1.5 pointer-events-none z-30" />
      <div className="absolute bottom-0 left-0 w-5 h-5 border-b border-l border-[var(--accent-color)] rounded-bl-lg transition-transform duration-300 group-hover:-translate-x-1.5 group-hover:translate-y-1.5 pointer-events-none z-30" />
      <div className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-[var(--accent-color)] rounded-br-lg transition-transform duration-300 group-hover:translate-x-1.5 group-hover:translate-y-1.5 pointer-events-none z-30" />

      <div
        className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[rgba(var(--accent-rgb),0.2)] via-white/5 to-purple-500/10 opacity-60 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0"
        style={{ boxShadow: "inset 0 0 25px rgba(var(--accent-rgb), 0.08)" }}
      />

      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#050505] shadow-[inset_0_0_40px_rgba(0,0,0,1)] border border-white/5 z-10 flex-shrink-0">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          loop={loop}
          muted={isMuted}
          playsInline
          aria-hidden="true"
          className="w-full h-full object-cover opacity-75 group-hover:opacity-95 transition-opacity duration-500 scale-105"
        />

        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.65)_100%)] z-10" />

        <div className="absolute top-3 left-4 flex items-center gap-1.5 z-20 font-mono text-[8px] tracking-[0.15em] text-white/70 bg-black/60 backdrop-blur-md py-0.5 px-2 rounded-md border border-white/5">
          <span className={`w-1.5 h-1.5 rounded-none ${isPlaying ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"}`} />
          <span>{isPlaying ? "ACTIVE" : "PAUSED"}</span>
        </div>

        <div className="absolute bottom-3 right-4 flex items-center gap-1.5 z-20 font-mono text-[8px] tracking-[0.1em] text-[var(--accent-color)] bg-black/70 backdrop-blur-md py-0.5 px-2 rounded-md border border-[rgba(var(--accent-rgb),0.2)] shadow-md">
          <span className="w-1 h-1 rounded-none bg-[var(--accent-color)] animate-pulse" />
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
      </div>

      {showControls && (
        <div className="relative w-full z-20 bg-gradient-to-r from-black/90 via-[#0c0c0d]/95 to-black/90 border border-white/10 hover:border-[rgba(var(--accent-rgb),0.3)] backdrop-blur-2xl rounded-xl p-2 flex items-center justify-between shadow-[0_20px_45px_rgba(0,0,0,0.8)] transition-all duration-300">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="w-8 h-8 rounded-full border border-white/10 hover:border-[var(--accent-color)] bg-white/5 hover:bg-[rgba(var(--accent-rgb),0.15)] flex items-center justify-center transition-all duration-300 relative group/btn cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none group-hover/btn:rotate-90 transition-transform duration-1000" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16.5" fill="none" stroke="var(--accent-color)" strokeWidth="1" strokeDasharray="3 3" className="opacity-30 group-hover/btn:opacity-100 transition-opacity" />
              </svg>
              {isPlaying ? (
                <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" className="text-white/80 group-hover/btn:text-[var(--accent-color)] transition-colors">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" className="text-white/80 group-hover/btn:text-[var(--accent-color)] transition-colors ml-[1px]">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
              className="w-8 h-8 rounded-full border border-white/10 hover:border-[var(--accent-color)] bg-white/5 hover:bg-[rgba(var(--accent-rgb),0.15)] flex items-center justify-center transition-all duration-300 relative group/btn cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none group-hover/btn:rotate-90 transition-transform duration-1000" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16.5" fill="none" stroke="var(--accent-color)" strokeWidth="1" strokeDasharray="3 3" className="opacity-30 group-hover/btn:opacity-100 transition-opacity" />
              </svg>
              {isMuted ? (
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80 group-hover/btn:text-[var(--accent-color)] transition-colors">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80 group-hover/btn:text-[var(--accent-color)] transition-colors">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>

            <div className="flex items-center gap-1 ml-1 select-none">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
                aria-label="Volume"
                className="w-10 sm:w-12 h-1 bg-white/10 hover:bg-white/20 rounded-lg appearance-none cursor-pointer accent-[var(--accent-color)] transition-all duration-300 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent-color)] [&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--accent-color)]"
              />
            </div>
          </div>

          <div className="flex-1 ml-3 mr-1 flex items-center justify-end">
            <div
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              tabIndex={0}
              onClick={handleProgressSeek}
              onKeyDown={handleSeekKey}
              className="flex items-center gap-[3px] cursor-pointer py-1.5 px-1 hover:bg-white/5 rounded-lg transition-colors w-full justify-between outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
            >
              {segs.map((_, i) => {
                const active = (i / segments) * 100 <= progress;
                return (
                  <div
                    key={i}
                    className={`h-3 w-[4px] rounded-[1px] transition-all duration-150 ${
                      active ? "bg-[var(--accent-color)] shadow-[0_0_6px_rgba(var(--accent-rgb),0.85)]" : "bg-white/10"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
