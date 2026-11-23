/**
 * Unroll — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
export const unrollMetadata = {
  slug: "unroll",
  name: "Unroll",
  title: "Unroll",
  description:
    "An image rolled up like a scroll, in grey. Point at it, or tap it, and it unrolls flat as its colour comes in; move away and it rolls back up. Shows the plain image under reduced motion.",
  version: "1.0.0",
  tier: "free",
  category: "media",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/unroll/index.ts",
      target: "unroll/index.ts",
      type: "component",
    },
    {
      path: "packages/components/unroll/Unroll.tsx",
      target: "unroll/Unroll.tsx",
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
  entry: "unroll/index.ts",
  exportName: "Unroll",
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/unroll",
  previewUrl: "https://vectorvesper.dev/components/unroll",
  draft: false,
} as const;
