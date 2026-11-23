/**
 * Wavy Grid — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
export const wavyGridMetadata = {
  slug: "wavy-grid",
  name: "Wavy Grid",
  title: "Wavy Grid",
  description:
    "A grid of fine lines rolling in slow, layered waves, with a soft swell that follows the pointer. Works on a light or dark ground. Shows a still grid under reduced motion.",
  version: "1.0.0",
  tier: "free",
  category: "background",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/wavy-grid/index.ts",
      target: "wavy-grid/index.ts",
      type: "component",
    },
    {
      path: "packages/components/wavy-grid/WavyGrid.tsx",
      target: "wavy-grid/WavyGrid.tsx",
      type: "component",
    },
  ],
  dependencies: ["@vectorvesper/motion", "three"],
  devDependencies: [],
  registryDependencies: [],
  requiresClient: true,
  supportsReducedMotion: true,
  usesWebGL: true,
  usesPointer: true,
  usesScroll: false,
  usesTailwind: false,
  entry: "wavy-grid/index.ts",
  exportName: "WavyGrid",
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/wavy-grid",
  previewUrl: "https://vectorvesper.dev/components/wavy-grid",
  draft: false,
} as const;
