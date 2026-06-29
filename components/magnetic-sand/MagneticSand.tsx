"use client";
import React, { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export interface MagneticSandProps {
  backgroundColor?: string;
  color1?: string;
  color2?: string;
  particleSize?: number;
  gridResolution?: number;
  glowIntensity?: number;
  trailSpeed?: number;
  className?: string;
  style?: React.CSSProperties;
}

const MagneticSandScene: React.FC<MagneticSandProps> = ({
  backgroundColor = "#ffffff",
  color1 = "#000000",
  color2 = "#00eeff",
  particleSize = 0.0,
  gridResolution = 140.0,
  glowIntensity = 0.3,
  trailSpeed = 0.05,
}) => {
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  const { viewport } = useThree();

  const setupRef = useRef<{
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D | null;
    heatTexture: THREE.CanvasTexture;
  } | null>(null);

  if (setupRef.current === null && typeof window !== "undefined") {
    const can = document.createElement("canvas");
    can.width = 256;
    can.height = 256;
    const context = can.getContext("2d");
    if (context) {
      context.fillStyle = "black";
      context.fillRect(0, 0, 256, 256);
    }
    const texture = new THREE.CanvasTexture(can);
    texture.minFilter = THREE.LinearFilter;
    setupRef.current = { canvas: can, ctx: context, heatTexture: texture };
  }

  useEffect(() => {
    return () => {
      if (setupRef.current) setupRef.current.heatTexture.dispose();
    };
  }, []);

  const lastMouse = useRef(new THREE.Vector2(0, 0));
  const velocity = useRef(0);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHeatMap: { value: null as THREE.Texture | null },
    uVelocity: { value: 0 },
    uBackgroundColor: { value: new THREE.Color() },
    uColor1: { value: new THREE.Color() },
    uColor2: { value: new THREE.Color() },
    uParticleSize: { value: 0 },
    uGridResolution: { value: 0 },
    uGlowIntensity: { value: 0 }
  }), []);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.material.uniforms.uBackgroundColor.value.set(backgroundColor);
      meshRef.current.material.uniforms.uColor1.value.set(color1);
      meshRef.current.material.uniforms.uColor2.value.set(color2);
      meshRef.current.material.uniforms.uParticleSize.value = particleSize;
      meshRef.current.material.uniforms.uGridResolution.value = gridResolution;
      meshRef.current.material.uniforms.uGlowIntensity.value = glowIntensity;
    }
  }, [backgroundColor, color1, color2, particleSize, gridResolution, glowIntensity]);

  useFrame((state) => {
    if (!setupRef.current) return;
    const { pointer, clock } = state;
    const ctx = setupRef.current.ctx;
    const heatTexture = setupRef.current.heatTexture;

    const v = pointer.distanceTo(lastMouse.current);
    velocity.current = THREE.MathUtils.lerp(velocity.current, v, 0.1);
    lastMouse.current.copy(pointer);

    if (ctx && heatTexture) {
      ctx.fillStyle = `rgba(0, 0, 0, ${trailSpeed})`;
      ctx.fillRect(0, 0, 256, 256);
      const x = (pointer.x * 0.5 + 0.5) * 256;
      const y = (1.0 - (pointer.y * 0.5 + 0.5)) * 256;
      const radius = 5 + velocity.current * 150;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${0.1 + velocity.current * 5.0})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      heatTexture.needsUpdate = true;
    }

    if (meshRef.current) {
      if (!meshRef.current.material.uniforms.uHeatMap.value) {
        meshRef.current.material.uniforms.uHeatMap.value = setupRef.current.heatTexture;
      }
      meshRef.current.material.uniforms.uTime.value = clock.getElapsedTime();
      meshRef.current.material.uniforms.uVelocity.value = velocity.current;
    }
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        transparent
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform sampler2D uHeatMap;
          uniform float uVelocity;
          uniform vec3 uBackgroundColor;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform float uParticleSize;
          uniform float uGridResolution;
          uniform float uGlowIntensity;
          varying vec2 vUv;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.1, 31.7))) * 43758.5453);
          }

          void main() {
            float heat = texture2D(uHeatMap, vUv).r;
            vec2 grid = fract(vUv * uGridResolution);
            vec2 id = floor(vUv * uGridResolution);
            float size = uParticleSize + heat * 1.8;
            vec2 jitter = vec2(hash(id + floor(uTime * 30.0)), hash(id + floor(uTime * 30.0) + 9.1)) - 0.5;
            float dist = length(grid - 0.5 + jitter * (heat * 0.4));
            float mask = smoothstep(size, size - 0.1, dist);
            vec3 particleColor = mix(uColor1, uColor2, heat);
            vec3 finalColor = mix(uBackgroundColor, particleColor, mask);
            finalColor += uColor2 * heat * uGlowIntensity * mask;
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `}
      />
    </mesh>
  );
};

export default function MagneticSandVisualizer({
  backgroundColor = "#ffffff",
  color1 = "#000000",
  color2 = "#00eeff",
  particleSize = 0.0,
  gridResolution = 140.0,
  glowIntensity = 0.3,
  trailSpeed = 0.05,
  className = "",
  style = {},
}: MagneticSandProps): React.JSX.Element {
  return (
    <div className={className} style={{ width: "100%", height: "100%", position: "relative", ...style }}>
      <Canvas
        camera={{ position: [0, 0, 1], fov: 50 }}
        style={{ width: "100%", height: "100%", display: "block" }}
        dpr={[1, 2]}
      >
        <MagneticSandScene
          backgroundColor={backgroundColor}
          color1={color1}
          color2={color2}
          particleSize={particleSize}
          gridResolution={gridResolution}
          glowIntensity={glowIntensity}
          trailSpeed={trailSpeed}
        />
      </Canvas>
    </div>
  );
}
