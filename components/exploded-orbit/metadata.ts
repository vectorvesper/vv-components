/**
 * Exploded Orbit — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
export const explodedOrbitMetadata = {
  slug: "exploded-orbit",
  name: "Exploded Orbit",
  title: "Exploded Orbit",
  description:
    "A pinned product section. Scroll, and your 3D model comes apart along its own axis like an exploded drawing, then its parts swing out to orbit the core, each with a label. Takes a .glb, a model built in three.js, or a stack of images. Lists the parts under reduced motion.",
  version: "1.0.0",
  tier: "free",
  category: "models",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/exploded-orbit/index.ts",
      target: "exploded-orbit/index.ts",
      type: "component",
    },
    {
      path: "packages/components/exploded-orbit/ExplodedOrbit.tsx",
      target: "exploded-orbit/ExplodedOrbit.tsx",
      type: "component",
    },
  ],
  dependencies: ["@vectorvesper/motion", "three"],
  devDependencies: [],
  registryDependencies: [],
  requiresClient: true,
  supportsReducedMotion: true,
  usesWebGL: true,
  usesPointer: false,
  usesScroll: true,
  usesTailwind: false,
  entry: "exploded-orbit/index.ts",
  exportName: "ExplodedOrbit",
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/exploded-orbit",
  previewUrl: "https://vectorvesper.dev/components/exploded-orbit",
  draft: false,
} as const;
