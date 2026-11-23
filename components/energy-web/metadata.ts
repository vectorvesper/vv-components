/**
 * Energy Web — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
export const energyWebMetadata = {
  slug: "energy-web",
  name: "Energy Web",
  title: "Energy Web",
  description:
    "Threads of light that branch out from a corner and crackle where the pointer goes, on a dark or light ground. Set the colours, thread count, spread and glow for a hero background. Holds still under reduced motion.",
  version: "1.0.0",
  tier: "free",
  category: "background",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/energy-web/index.ts",
      target: "energy-web/index.ts",
      type: "component",
    },
    {
      path: "packages/components/energy-web/EnergyWeb.tsx",
      target: "energy-web/EnergyWeb.tsx",
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
  entry: "energy-web/index.ts",
  exportName: "EnergyWeb",
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/energy-web",
  previewUrl: "https://vectorvesper.dev/components/energy-web",
  draft: false,
} as const;
