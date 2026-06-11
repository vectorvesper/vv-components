"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, useTexture } from "@react-three/drei";
import * as THREE from "three";

interface SceneProps {
  imageUrls: string[];
  scrollProgressRef: React.RefObject<number>;
  mode: "square" | "rect" | "quad";
  cubeSize: number;
  glassThickness: number;
  glassRoughness: number;
  glassOpacity: number;
  glassColor: string;
  autoSpinSpeed: number;
  scrollSpins: number;
  mouseTiltIntensity: number;
  lerpSpeed: number;
  rotationLerpSpeed: number;
  scaleLerpSpeed: number;
  hoverTransparency: boolean;
  photoOpacity: number;
  galleryItemWidth?: number;
  galleryItemHeight?: number;
  gridGapX?: number;
  gridGapY?: number;
  unfoldEnd: number;
}

function CollageFace({
  texture,
  basePos,
  flatPos,
  baseRot,
  foldedScale,
  flatScale,
  scrollProgressRef,
  lerpSpeed,
  scaleLerpSpeed,
  hoverTransparency,
  photoOpacity,
  unfoldEnd,
}: {
  texture: THREE.Texture;
  basePos: [number, number, number];
  flatPos: [number, number, number];
  baseRot: [number, number, number];
  foldedScale: [number, number];
  flatScale: [number, number];
  scrollProgressRef: React.RefObject<number>;
  lerpSpeed: number;
  scaleLerpSpeed: number;
  hoverTransparency: boolean;
  photoOpacity: number;
  unfoldEnd: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const hoveredRef = useRef(false);
  const lerpedProgressRef = useRef(0);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    const damping = 1.0 - Math.exp(-lerpSpeed * delta * 60);
    const scaleDamping = 1.0 - Math.exp(-scaleLerpSpeed * delta * 60);

    lerpedProgressRef.current += (scrollProgressRef.current - lerpedProgressRef.current) * damping;
    const unfoldProgress = Math.min(1.0, lerpedProgressRef.current / unfoldEnd);
    const u = 1.0 - unfoldProgress;

    const hovered = hoveredRef.current;
    const is2DHoverActive = u < 0.15 && hovered;
    const hoverZOffset = is2DHoverActive ? 0.25 : 0.0;
    const hoverScaleFactor = is2DHoverActive ? 1.08 : 1.0;

    const targetX = (1 - u) * flatPos[0] + u * basePos[0];
    const targetY = (1 - u) * flatPos[1] + u * basePos[1];
    const targetZ = (1 - u) * flatPos[2] + u * basePos[2] + hoverZOffset;

    meshRef.current.position.x += (targetX - meshRef.current.position.x) * damping;
    meshRef.current.position.y += (targetY - meshRef.current.position.y) * damping;
    meshRef.current.position.z += (targetZ - meshRef.current.position.z) * damping;

    const targetScaleX = ((1 - u) * (flatScale[0] / foldedScale[0]) + u) * hoverScaleFactor;
    const targetScaleY = ((1 - u) * (flatScale[1] / foldedScale[1]) + u) * hoverScaleFactor;

    meshRef.current.scale.x += (targetScaleX - meshRef.current.scale.x) * scaleDamping;
    meshRef.current.scale.y += (targetScaleY - meshRef.current.scale.y) * scaleDamping;
    meshRef.current.scale.z += (hoverScaleFactor - meshRef.current.scale.z) * scaleDamping;

    meshRef.current.rotation.x += (baseRot[0] * u - meshRef.current.rotation.x) * damping;
    meshRef.current.rotation.y += (baseRot[1] * u - meshRef.current.rotation.y) * damping;
    meshRef.current.rotation.z += (baseRot[2] * u - meshRef.current.rotation.z) * damping;

    if (materialRef.current) {
      const isHoverActive = u > 0.8 && hovered && hoverTransparency;
      const targetOpacity = isHoverActive ? 0.0 : (1.0 - (1.0 - photoOpacity) * u);
      materialRef.current.opacity += (targetOpacity - materialRef.current.opacity) * (1.0 - Math.exp(-0.15 * delta * 60));
      materialRef.current.color.setRGB(u, u, u);
      materialRef.current.emissive.setRGB(1.0 - u, 1.0 - u, 1.0 - u);
    }
  });

  return (
    <mesh
      ref={meshRef}
      onPointerOver={(e) => { e.stopPropagation(); hoveredRef.current = true; }}
      onPointerOut={() => { hoveredRef.current = false; }}
    >
      <planeGeometry args={foldedScale} />
      <meshPhysicalMaterial
        ref={materialRef}
        map={texture}
        emissiveMap={texture}
        emissive="#ffffff"
        transparent
        opacity={1.0}
        side={THREE.DoubleSide}
        roughness={1.0}
        metalness={0.0}
        clearcoat={0.0}
        clearcoatRoughness={0.25}
        depthWrite
        toneMapped={false}
      />
    </mesh>
  );
}

const HP = Math.PI / 2;

function PhotoCollage({
  imageUrls,
  scrollProgressRef,
  mode,
  cubeSize,
  lerpSpeed,
  scaleLerpSpeed,
  hoverTransparency,
  photoOpacity,
  galleryItemWidth,
  galleryItemHeight,
  gridGapX,
  gridGapY,
  unfoldEnd,
}: any) {
  const { gl } = useThree();
  const textures = useTexture(imageUrls) as THREE.Texture[];

  useEffect(() => {
    const maxAniso = Math.min(4, gl.capabilities.getMaxAnisotropy());
    textures.forEach((tex) => {
      if (!tex) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = maxAniso;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
    });
  }, [textures, gl]);

  const qO = 0.715 * cubeSize;
  const bO = 1.51 * cubeSize;
  const rectS = useMemo(() => [2.8 * cubeSize, 1.37 * cubeSize] as [number, number], [cubeSize]);
  const sqS = useMemo(() => [2.8 * cubeSize, 2.8 * cubeSize] as [number, number], [cubeSize]);
  const qdS = useMemo(() => [1.37 * cubeSize, 1.37 * cubeSize] as [number, number], [cubeSize]);

  const config = useMemo(() => {
    let raw: any[] = [];

    if (mode === "square") {
      raw = [
        { basePos: [-bO, 0, 0], baseRot: [0, -HP, 0], foldedScale: sqS, texIndex: 0, col: 0, row: 0, cols: 3, rows: 2 },
        { basePos: [0, 0, bO], baseRot: [0, 0, 0], foldedScale: sqS, texIndex: 1, col: 1, row: 0, cols: 3, rows: 2 },
        { basePos: [bO, 0, 0], baseRot: [0, HP, 0], foldedScale: sqS, texIndex: 2, col: 2, row: 0, cols: 3, rows: 2 },
        { basePos: [0, 0, -bO], baseRot: [0, Math.PI, 0], foldedScale: sqS, texIndex: 3, col: 0, row: 1, cols: 3, rows: 2 },
        { basePos: [0, bO, 0], baseRot: [-HP, 0, 0], foldedScale: sqS, texIndex: 4, col: 1, row: 1, cols: 3, rows: 2 },
        { basePos: [0, -bO, 0], baseRot: [HP, 0, 0], foldedScale: sqS, texIndex: 5, col: 2, row: 1, cols: 3, rows: 2 },
      ];
    } else if (mode === "rect") {
      raw = [
        { basePos: [-bO, +qO, 0], baseRot: [0, -HP, 0], foldedScale: rectS, texIndex: 0, col: 0, row: 0, cols: 6, rows: 2 },
        { basePos: [-bO, -qO, 0], baseRot: [0, -HP, 0], foldedScale: rectS, texIndex: 6, col: 0, row: 1, cols: 6, rows: 2 },
        { basePos: [0, +qO, bO], baseRot: [0, 0, 0], foldedScale: rectS, texIndex: 1, col: 1, row: 0, cols: 6, rows: 2 },
        { basePos: [0, -qO, bO], baseRot: [0, 0, 0], foldedScale: rectS, texIndex: 7, col: 1, row: 1, cols: 6, rows: 2 },
        { basePos: [bO, +qO, 0], baseRot: [0, HP, 0], foldedScale: rectS, texIndex: 2, col: 2, row: 0, cols: 6, rows: 2 },
        { basePos: [bO, -qO, 0], baseRot: [0, HP, 0], foldedScale: rectS, texIndex: 8, col: 2, row: 1, cols: 6, rows: 2 },
        { basePos: [0, +qO, -bO], baseRot: [0, Math.PI, 0], foldedScale: rectS, texIndex: 3, col: 3, row: 0, cols: 6, rows: 2 },
        { basePos: [0, -qO, -bO], baseRot: [0, Math.PI, 0], foldedScale: rectS, texIndex: 9, col: 3, row: 1, cols: 6, rows: 2 },
        { basePos: [0, bO, -qO], baseRot: [-HP, 0, 0], foldedScale: rectS, texIndex: 4, col: 4, row: 0, cols: 6, rows: 2 },
        { basePos: [0, bO, +qO], baseRot: [-HP, 0, 0], foldedScale: rectS, texIndex: 10, col: 4, row: 1, cols: 6, rows: 2 },
        { basePos: [0, -bO, +qO], baseRot: [HP, 0, 0], foldedScale: rectS, texIndex: 5, col: 5, row: 0, cols: 6, rows: 2 },
        { basePos: [0, -bO, -qO], baseRot: [HP, 0, 0], foldedScale: rectS, texIndex: 11, col: 5, row: 1, cols: 6, rows: 2 },
      ];
    } else {
      raw = [
        { basePos: [-bO, +qO, -qO], baseRot: [0, -HP, 0], foldedScale: qdS, texIndex: 0, col: 0, row: 0, cols: 8, rows: 3 },
        { basePos: [-bO, -qO, -qO], baseRot: [0, -HP, 0], foldedScale: qdS, texIndex: 12, col: 0, row: 2, cols: 8, rows: 3 },
        { basePos: [-bO, +qO, +qO], baseRot: [0, -HP, 0], foldedScale: qdS, texIndex: 1, col: 1, row: 0, cols: 8, rows: 3 },
        { basePos: [-bO, -qO, +qO], baseRot: [0, -HP, 0], foldedScale: qdS, texIndex: 13, col: 1, row: 2, cols: 8, rows: 3 },
        { basePos: [-qO, +qO, bO], baseRot: [0, 0, 0], foldedScale: qdS, texIndex: 2, col: 2, row: 0, cols: 8, rows: 3 },
        { basePos: [-qO, -qO, bO], baseRot: [0, 0, 0], foldedScale: qdS, texIndex: 14, col: 2, row: 2, cols: 8, rows: 3 },
        { basePos: [+qO, +qO, bO], baseRot: [0, 0, 0], foldedScale: qdS, texIndex: 3, col: 3, row: 0, cols: 8, rows: 3 },
        { basePos: [+qO, -qO, bO], baseRot: [0, 0, 0], foldedScale: qdS, texIndex: 15, col: 3, row: 2, cols: 8, rows: 3 },
        { basePos: [bO, +qO, +qO], baseRot: [0, HP, 0], foldedScale: qdS, texIndex: 4, col: 4, row: 0, cols: 8, rows: 3 },
        { basePos: [bO, -qO, +qO], baseRot: [0, HP, 0], foldedScale: qdS, texIndex: 16, col: 4, row: 2, cols: 8, rows: 3 },
        { basePos: [bO, +qO, -qO], baseRot: [0, HP, 0], foldedScale: qdS, texIndex: 5, col: 5, row: 0, cols: 8, rows: 3 },
        { basePos: [bO, -qO, -qO], baseRot: [0, HP, 0], foldedScale: qdS, texIndex: 17, col: 5, row: 2, cols: 8, rows: 3 },
        { basePos: [+qO, +qO, -bO], baseRot: [0, Math.PI, 0], foldedScale: qdS, texIndex: 6, col: 6, row: 0, cols: 8, rows: 3 },
        { basePos: [+qO, -qO, -bO], baseRot: [0, Math.PI, 0], foldedScale: qdS, texIndex: 18, col: 6, row: 2, cols: 8, rows: 3 },
        { basePos: [-qO, +qO, -bO], baseRot: [0, Math.PI, 0], foldedScale: qdS, texIndex: 7, col: 7, row: 0, cols: 8, rows: 3 },
        { basePos: [-qO, -qO, -bO], baseRot: [0, Math.PI, 0], foldedScale: qdS, texIndex: 19, col: 7, row: 2, cols: 8, rows: 3 },
        { basePos: [-qO, bO, -qO], baseRot: [-HP, 0, 0], foldedScale: qdS, texIndex: 8, col: 0, row: 1, cols: 8, rows: 3 },
        { basePos: [-qO, bO, +qO], baseRot: [-HP, 0, 0], foldedScale: qdS, texIndex: 20, col: 1, row: 1, cols: 8, rows: 3 },
        { basePos: [+qO, bO, -qO], baseRot: [-HP, 0, 0], foldedScale: qdS, texIndex: 9, col: 2, row: 1, cols: 8, rows: 3 },
        { basePos: [+qO, bO, +qO], baseRot: [-HP, 0, 0], foldedScale: qdS, texIndex: 21, col: 3, row: 1, cols: 8, rows: 3 },
        { basePos: [-qO, -bO, +qO], baseRot: [HP, 0, 0], foldedScale: qdS, texIndex: 10, col: 4, row: 1, cols: 8, rows: 3 },
        { basePos: [-qO, -bO, -qO], baseRot: [HP, 0, 0], foldedScale: qdS, texIndex: 22, col: 5, row: 1, cols: 8, rows: 3 },
        { basePos: [+qO, -bO, +qO], baseRot: [HP, 0, 0], foldedScale: qdS, texIndex: 11, col: 6, row: 1, cols: 8, rows: 3 },
        { basePos: [+qO, -bO, -qO], baseRot: [HP, 0, 0], foldedScale: qdS, texIndex: 23, col: 7, row: 1, cols: 8, rows: 3 },
      ];
    }

    const gX = gridGapX ?? 0.12 * cubeSize;
    const gY = gridGapY ?? (mode === "rect" ? 0.13 * cubeSize : 0.12 * cubeSize);
    const cols = raw[0]?.cols || 1;
    const rows = raw[0]?.rows || 1;

    return raw.map((f) => {
      const w = galleryItemWidth ?? f.foldedScale[0];
      const h = galleryItemHeight ?? f.foldedScale[1];
      const startX = -((cols - 1) * (w + gX)) / 2;
      const startY = ((rows - 1) * (h + gY)) / 2;
      return {
        ...f,
        flatScale: [w, h],
        flatPos: [startX + f.col * (w + gX), startY - f.row * (h + gY), 0],
      };
    });
  }, [mode, cubeSize, rectS, sqS, qdS, bO, qO, galleryItemWidth, galleryItemHeight, gridGapX, gridGapY]);

  return (
    <>
      {config.map((face: any, i: number) => (
        <CollageFace
          key={`${mode}-${i}`}
          texture={textures[face.texIndex]}
          basePos={face.basePos}
          flatPos={face.flatPos}
          baseRot={face.baseRot}
          foldedScale={face.foldedScale}
          flatScale={face.flatScale}
          scrollProgressRef={scrollProgressRef}
          lerpSpeed={lerpSpeed}
          scaleLerpSpeed={scaleLerpSpeed}
          hoverTransparency={hoverTransparency}
          photoOpacity={photoOpacity}
          unfoldEnd={unfoldEnd}
        />
      ))}
    </>
  );
}

export default function Scene({
  imageUrls,
  scrollProgressRef,
  mode,
  cubeSize,
  glassThickness,
  glassRoughness,
  glassOpacity,
  glassColor,
  autoSpinSpeed,
  scrollSpins,
  mouseTiltIntensity,
  lerpSpeed,
  rotationLerpSpeed,
  scaleLerpSpeed,
  hoverTransparency,
  photoOpacity,
  galleryItemWidth,
  galleryItemHeight,
  gridGapX,
  gridGapY,
  unfoldEnd,
}: SceneProps) {

  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const glassRef = useRef<THREE.Mesh>(null);
  const glassMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const coreLightRef = useRef<THREE.PointLight>(null);

  useEffect(() => {
    if (gl && gl.domElement) {
      gl.domElement.style.touchAction = "pan-y";
    }
  }, [gl]);

  const gridHeight = useMemo(() => {
    const rows = mode === "quad" ? 3 : 2;
    const itemH = galleryItemHeight ?? (mode === "square" ? 2.8 : 1.37) * cubeSize;
    const gY = gridGapY ?? (mode === "rect" ? 0.13 : 0.12) * cubeSize;
    return rows * itemH + (rows - 1) * gY;
  }, [mode, cubeSize, galleryItemHeight, gridGapY]);

  const animTimeRef = useRef(0);
  const lerpedProgressRef = useRef(0);
  const startRotYRef = useRef(0);
  const hasStartedScrollRef = useRef(false);

  useFrame((state, delta) => {
    const damping = 1.0 - Math.exp(-lerpSpeed * delta * 60);
    const rotDamping = 1.0 - Math.exp(-rotationLerpSpeed * delta * 60);
    const scaleDamping = 1.0 - Math.exp(-scaleLerpSpeed * delta * 60);

    lerpedProgressRef.current += (scrollProgressRef.current - lerpedProgressRef.current) * damping;
    const scrollProgress = lerpedProgressRef.current;
    const unfoldProgress = Math.min(1.0, scrollProgress / unfoldEnd);
    const u = 1.0 - unfoldProgress;

    if (!groupRef.current) return;

    if (scrollProgressRef.current === 0) {
      if (hasStartedScrollRef.current) {
        const currentRotY = groupRef.current.rotation.y;
        animTimeRef.current = currentRotY / Math.max(0.01, autoSpinSpeed);
        hasStartedScrollRef.current = false;
      }
      animTimeRef.current += delta;
    } else if (!hasStartedScrollRef.current) {
      const currentRotY = groupRef.current.rotation.y;
      const wrappedRotY = ((currentRotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      groupRef.current.rotation.y = wrappedRotY;
      startRotYRef.current = wrappedRotY;
      hasStartedScrollRef.current = true;
    }
    const t = animTimeRef.current;
    const rotEase = 0.5 * (1.0 - Math.cos(u * Math.PI));

    const targetRotX = (0.35 + 0.1 * Math.sin(t * 0.5) - state.pointer.y * mouseTiltIntensity) * rotEase;
    const targetRotY = scrollProgressRef.current === 0
      ? (t * autoSpinSpeed + state.pointer.x * mouseTiltIntensity)
      : (startRotYRef.current + state.pointer.x * mouseTiltIntensity) * rotEase + (1.0 - rotEase) * (scrollSpins * Math.PI * 2);
    const targetRotZ = (0.2 + 0.08 * Math.cos(t * 0.4)) * rotEase;

    groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * rotDamping;
    groupRef.current.rotation.y += (targetRotY - groupRef.current.rotation.y) * rotDamping;
    groupRef.current.rotation.z += (targetRotZ - groupRef.current.rotation.z) * rotDamping;

    const aspect = state.size.width / state.size.height;
    const responsiveScale = aspect < 1.0 ? Math.max(0.65, aspect) : 1.0;
    const targetScale = (0.55 + 0.45 * u) * responsiveScale;
    const nextScale = groupRef.current.scale.x + (targetScale - groupRef.current.scale.x) * scaleDamping;
    groupRef.current.scale.set(nextScale, nextScale, nextScale);

    let viewportHeight = 5.467;
    if (state.camera instanceof THREE.PerspectiveCamera) {
      const fovRad = (state.camera.fov * Math.PI) / 180;
      viewportHeight = 2 * Math.tan(fovRad / 2) * Math.abs(state.camera.position.z);
    }
    const maxScroll = Math.max(0, gridHeight * nextScale - viewportHeight);
    let targetY = 0;
    if (scrollProgress >= unfoldEnd && unfoldEnd < 0.99) {
      const slideEnd = unfoldEnd + (1.0 - unfoldEnd) * 0.25;
      if (scrollProgress < slideEnd) {
        targetY = ((scrollProgress - unfoldEnd) / Math.max(0.001, slideEnd - unfoldEnd)) * (-maxScroll / 2);
      } else {
        targetY = -maxScroll / 2 + ((scrollProgress - slideEnd) / Math.max(0.001, 1.0 - slideEnd)) * maxScroll;
      }
    }
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * damping;

    if (glassRef.current) {
      const s = 0.001 + 0.999 * u;
      glassRef.current.scale.set(s, s, s);
    }
    if (glassMaterialRef.current) {
      const glassTargetOpacity = scrollProgressRef.current === 0.0 ? glassOpacity : 0.0;
      
      // Smoothly animate opacity
      glassMaterialRef.current.opacity += (glassTargetOpacity - glassMaterialRef.current.opacity) * (1.0 - Math.exp(-0.15 * delta * 60));
      
      // Directly sync physical uniforms on the active WebGL instance to bypass caching
      glassMaterialRef.current.thickness = glassThickness;
      glassMaterialRef.current.roughness = glassRoughness;
      
      // Dynamically update reflective tint color
      if (glassColor) {
        glassMaterialRef.current.color.set(glassColor);
      }
    }

    if (coreLightRef.current) coreLightRef.current.intensity = 5 * u;
  });

  return (
    <group ref={groupRef}>
      <PhotoCollage
        imageUrls={imageUrls}
        scrollProgressRef={scrollProgressRef}
        mode={mode}
        cubeSize={cubeSize}
        lerpSpeed={lerpSpeed}
        scaleLerpSpeed={scaleLerpSpeed}
        hoverTransparency={hoverTransparency}
        photoOpacity={photoOpacity}
        galleryItemWidth={galleryItemWidth}
        galleryItemHeight={galleryItemHeight}
        gridGapX={gridGapX}
        gridGapY={gridGapY}
        unfoldEnd={unfoldEnd}
      />

      <pointLight ref={coreLightRef} position={[0, 0, 0]} intensity={0} distance={10} decay={1.6} color={glassColor} />

      <RoundedBox
        ref={glassRef}
        args={[3.02 * cubeSize, 3.02 * cubeSize, 3.02 * cubeSize]}
        radius={0.06 * cubeSize}
        smoothness={4}
        scale={[0.001, 0.001, 0.001]}
      >
        <meshPhysicalMaterial
          ref={glassMaterialRef}
          transmission={1.0}
          roughness={glassRoughness}
          thickness={glassThickness}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          ior={1.45}
          color={glassColor}
          transparent
          opacity={0.0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </RoundedBox>

      <directionalLight position={[-8, 10, -2]} intensity={1.2} />
      <directionalLight position={[8, -5, 6]} intensity={0.7} />
    </group>
  );
}
