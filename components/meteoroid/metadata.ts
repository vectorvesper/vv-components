/**
 * Meteoroid — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
export const meteoroidMetadata = {
  slug: "meteoroid",
  name: "Meteoroid",
  title: "Meteoroid",
  description:
    "A cratered, hollow stone lit by one hard sun, with a second light inside shining out through holes in the craters. It turns slowly on its own, and a drag turns it, a flick throws it. Each seed makes a different rock. Shows a poster under reduced motion.",
  version: "1.0.0",
  tier: "free",
  category: "models",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/meteoroid/index.ts",
      target: "meteoroid/index.ts",
      type: "component",
    },
    {
      path: "packages/components/meteoroid/Meteoroid.tsx",
      target: "meteoroid/Meteoroid.tsx",
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
  entry: "meteoroid/index.ts",
  exportName: "Meteoroid",
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/meteoroid",
  previewUrl: "https://vectorvesper.dev/components/meteoroid",
  draft: false,
} as const;
