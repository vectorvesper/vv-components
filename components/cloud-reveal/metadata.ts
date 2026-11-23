/**
 * Cloud Reveal — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
export const cloudRevealMetadata = {
  slug: "cloud-reveal",
  name: "Cloud Reveal",
  title: "Cloud Reveal",
  description:
    "An image hidden under drifting mist. The pointer clears a soft hole that grows while it stays and closes again when it leaves. Shows the plain image under reduced motion.",
  version: "1.0.0",
  tier: "free",
  category: "media",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/cloud-reveal/index.ts",
      target: "cloud-reveal/index.ts",
      type: "component",
    },
    {
      path: "packages/components/cloud-reveal/CloudReveal.tsx",
      target: "cloud-reveal/CloudReveal.tsx",
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
  entry: "cloud-reveal/index.ts",
  exportName: "CloudReveal",
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/cloud-reveal",
  previewUrl: "https://vectorvesper.dev/components/cloud-reveal",
  draft: false,
} as const;
