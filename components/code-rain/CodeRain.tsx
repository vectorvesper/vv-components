"use client";
import React, { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export interface CodeRainProps {
  backgroundColor?: string;
  color1?: string;
  color2?: string;
  gridResolution?: number;
  intensityDecay?: number;
  explosionRadius?: number;
  glowIntensity?: number;
  scanlineIntensity?: number;
  trailSpeed?: number;
  burstPattern?: "digital" | "circular";
  className?: string;
  style?: React.CSSProperties;
}

const CodeRainScene: React.FC<CodeRainProps> = ({
  backgroundColor = "#000000",
  color1 = "#001a0a",
  color2 = "#00ff66",
  gridResolution = 80.0,
  intensityDecay = 0.96,
  explosionRadius = 30.0,
  glowIntensity = 0.4,
  scanlineIntensity = 0.05,
  trailSpeed = 0.12,
  burstPattern = "digital",
}) => {
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  const { viewport } = useThree();
  const setupRef = useRef<{
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D | null;
    heatTexture: THREE.CanvasTexture;
  } | null>(null);

  const propsRef = useRef({ explosionRadius, intensityDecay, trailSpeed, burstPattern });
  useEffect(() => {
    propsRef.current = { explosionRadius, intensityDecay, trailSpeed, burstPattern };
  }, [explosionRadius, intensityDecay, trailSpeed, burstPattern]);

  if (setupRef.current === null && typeof window !== "undefined") {
    const can = document.createElement("canvas");
    can.width = 512;
    can.height = 512;
    const context = can.getContext("2d");
    if (context) {
      context.fillStyle = "black";
      context.fillRect(0, 0, 512, 512);
    }
    const texture = new THREE.CanvasTexture(can);
    texture.minFilter = THREE.LinearFilter;
    setupRef.current = { canvas: can, ctx: context, heatTexture: texture };
  }

  const typingIntensity = useRef(0);

  useEffect(() => {
    const triggerBurst = (x: number, y: number) => {
      const setup = setupRef.current;
      if (!setup || !setup.ctx) return;
      typingIntensity.current = Math.min(typingIntensity.current + 0.15, 1.0);
      setup.ctx.save();
      setup.ctx.globalCompositeOperation = "lighter";

      if (propsRef.current.burstPattern === "circular") {
        const radius = propsRef.current.explosionRadius + Math.random() * 60;
        const gradient = setup.ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        setup.ctx.fillStyle = gradient;
        setup.ctx.beginPath();
        setup.ctx.arc(x, y, radius, 0, Math.PI * 2);
        setup.ctx.fill();
      } else {
        const count = 10;
        for (let i = 0; i < count; i++) {
          const offX = (Math.random() - 0.5) * propsRef.current.explosionRadius * 2;
          const offY = (Math.random() - 0.5) * propsRef.current.explosionRadius * 2;
          const size = 10 + Math.random() * 20;
          setup.ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.random() * 0.4})`;
          setup.ctx.fillRect(x + offX - size / 2, y + offY - size / 2, size, size);
        }
      }
      setup.ctx.restore();
      setup.heatTexture.needsUpdate = true;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== " ") triggerBurst(Math.random() * 512, Math.random() * 512);
    };

    const handleMouseDown = (e: MouseEvent) => {
      triggerBurst((e.clientX / window.innerWidth) * 512, (e.clientY / window.innerHeight) * 512);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHeatMap: { value: null as THREE.Texture | null },
    uIntensity: { value: 0 },
    uBackgroundColor: { value: new THREE.Color(backgroundColor) },
    uColor1: { value: new THREE.Color(color1) },
    uColor2: { value: new THREE.Color(color2) },
    uGridResolution: { value: gridResolution },
    uGlowIntensity: { value: glowIntensity },
    uScanlineIntensity: { value: scanlineIntensity },
  }), []);

  useEffect(() => {
    if (meshRef.current) {
      const u = meshRef.current.material.uniforms;
      u.uBackgroundColor.value.set(backgroundColor);
      u.uColor1.value.set(color1);
      u.uColor2.value.set(color2);
      u.uGridResolution.value = gridResolution;
      u.uGlowIntensity.value = glowIntensity;
      u.uScanlineIntensity.value = scanlineIntensity;
    }
  }, [backgroundColor, color1, color2, gridResolution, glowIntensity, scanlineIntensity]);

  useFrame((state) => {
    const setup = setupRef.current;
    if (!setup) return;
    typingIntensity.current *= propsRef.current.intensityDecay;

    if (setup.ctx) {
      setup.ctx.fillStyle = `rgba(0, 0, 0, ${propsRef.current.trailSpeed})`;
      setup.ctx.fillRect(0, 0, 512, 512);
      setup.heatTexture.needsUpdate = true;
    }

    if (meshRef.current) {
      if (!meshRef.current.material.uniforms.uHeatMap.value) {
        meshRef.current.material.uniforms.uHeatMap.value = setup.heatTexture;
      }
      meshRef.current.material.uniforms.uTime.value = state.clock.getElapsedTime();
      meshRef.current.material.uniforms.uIntensity.value = typingIntensity.current;
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
          uniform float uIntensity;
          uniform vec3 uBackgroundColor;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform float uGridResolution;
          uniform float uGlowIntensity;
          uniform float uScanlineIntensity;
          varying vec2 vUv;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          void main() {
            float heat = texture2D(uHeatMap, vUv).r;
            float gridRes = uGridResolution;
            vec2 grid = fract(vUv * gridRes);
            vec2 id = floor(vUv * gridRes);
            float glyphType = hash(id);
            float mask = 0.0;

            if (glyphType < 0.35) {
              float inner = smoothstep(0.15, 0.17, abs(grid.x - 0.5)) + smoothstep(0.25, 0.27, abs(grid.y - 0.5));
              float outer = smoothstep(0.35, 0.33, abs(grid.x - 0.5)) * smoothstep(0.45, 0.43, abs(grid.y - 0.5));
              mask = outer * clamp(inner, 0.0, 1.0);
            } else if (glyphType < 0.7) {
              mask = smoothstep(0.08, 0.06, abs(grid.x - 0.5)) * smoothstep(0.45, 0.43, abs(grid.y - 0.5));
            }

            float fade = clamp(heat * 6.0 + uIntensity * 0.4, 0.0, 1.0);
            vec3 glyphColor = mix(uColor1, uColor2, fade);
            vec3 color = mix(uBackgroundColor, glyphColor, mask);
            color += uColor2 * (heat * uGlowIntensity + uIntensity * 0.2) * mask;
            color -= sin(vUv.y * 400.0) * uScanlineIntensity;
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
};

export default function CodeRainVisualizer(props: CodeRainProps) {
  return (
    <div className={props.className} style={{ width: "100%", height: "100%", position: "relative", ...props.style }}>
      <Canvas
        camera={{ position: [0, 0, 1], fov: 50 }}
        style={{ width: "100%", height: "100%", display: "block" }}
        dpr={[1, 2]}
      >
        <CodeRainScene {...props} />
      </Canvas>
    </div>
  );
}
