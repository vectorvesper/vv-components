/**
 * Prismatic Triangles — Vector Vesper
 * https://vectorvesper.dev/components
 *
 * Copyright (c) 2026 Vector Vesper
 * Released under the MIT License. This notice must be retained in copies and
 * substantial portions of the file. https://vectorvesper.dev/license
 */
export const prismaticTrianglesMetadata = {
  slug: "prismatic-triangles",
  name: "Prismatic Triangles",
  title: "Prismatic Triangles",
  description:
    "Your image seen through a wall of faceted glass. Each triangle bends the picture at its own angle and splits the colour at its edges, and the facets lean toward the pointer as it passes. Shows the plain image under reduced motion.",
  version: "1.0.0",
  tier: "free",
  category: "media",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/prismatic-triangles/index.ts",
      target: "prismatic-triangles/index.ts",
      type: "component",
    },
    {
      path: "packages/components/prismatic-triangles/PrismaticTriangles.tsx",
      target: "prismatic-triangles/PrismaticTriangles.tsx",
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
  entry: "prismatic-triangles/index.ts",
  exportName: "PrismaticTriangles",
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/prismatic-triangles",
  previewUrl: "https://vectorvesper.dev/components/prismatic-triangles",
  draft: false,
} as const;
