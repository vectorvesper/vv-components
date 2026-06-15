export const glassGalleryMetadata = {
  slug: "glass-gallery",
  name: "Glass Gallery",
  title: "Glass Gallery",
  description: "An immersive 3D glass-morphic photo gallery cube that disassembles into a flat responsive image collage on scroll.",
  version: "1.0.0",
  tier: "free",
  category: "gallery",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/glass-gallery/index.ts",
      target: "glass-gallery/index.ts",
      type: "component"
    },
    {
      path: "packages/components/glass-gallery/GlassGallery.tsx",
      target: "glass-gallery/GlassGallery.tsx",
      type: "component"
    },
    {
      path: "packages/components/glass-gallery/GlassGalleryOverlay.tsx",
      target: "glass-gallery/GlassGalleryOverlay.tsx",
      type: "component"
    },
    {
      path: "packages/components/glass-gallery/Scene.tsx",
      target: "glass-gallery/Scene.tsx",
      type: "component"
    }
  ],
  dependencies: ["three", "@react-three/fiber", "@react-three/drei", "gsap", "@gsap/react"],
  devDependencies: [],
  registryDependencies: [],
  requiresClient: true,
  supportsReducedMotion: false,
  usesWebGL: true,
  usesPointer: true,
  usesScroll: true,
  entry: "glass-gallery/index.ts",
  exportName: "default",
  usesTailwind: true,
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/glass-gallery",
  previewUrl: "https://vectorvesper.dev/components/glass-gallery"
} as const;
