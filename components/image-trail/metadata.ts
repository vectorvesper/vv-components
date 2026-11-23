/**
 * Image Trail — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
export const imageTrailMetadata = {
  slug: "image-trail",
  name: "Image Trail",
  title: "Image Trail",
  description:
    "Images follow the pointer and fade behind it. Each one pops in, leans the way the pointer is moving and drifts off, and a fast stroke fills its gaps so the trail never breaks up. It reads the shared pointer sensor, reuses a fixed set of images and keeps fewer in the air on a slow device. Does nothing under reduced motion.",
  version: "1.0.0",
  tier: "free",
  category: "cursor",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/image-trail/index.ts",
      target: "image-trail/index.ts",
      type: "component",
    },
    {
      path: "packages/components/image-trail/ImageTrail.tsx",
      target: "image-trail/ImageTrail.tsx",
      type: "component",
    },
  ],
  dependencies: ["@vectorvesper/motion"],
  devDependencies: [],
  registryDependencies: [],
  requiresClient: true,
  supportsReducedMotion: true,
  usesWebGL: false,
  usesPointer: true,
  usesScroll: false,
  usesTailwind: false,
  entry: "image-trail/index.ts",
  exportName: "ImageTrail",
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/image-trail",
  previewUrl: "https://vectorvesper.dev/components/image-trail",
  draft: false,
} as const;
