export const imageTickerMetadata = {
  slug: "image-ticker",
  name: "Image Ticker",
  title: "Image Ticker",
  description: "A gorgeous, cinematic dual-ticker displaying rows of images rotating in opposite directions with built-in lightbox functionality.",
  version: "1.0.0",
  tier: "free",
  category: "interaction",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/image-ticker/ImageTicker.tsx",
      target: "image-ticker/ImageTicker.tsx",
      type: "component"
    },
    {
      path: "packages/components/image-ticker/SmoothTicker.tsx",
      target: "image-ticker/SmoothTicker.tsx",
      type: "component"
    },
    {
      path: "packages/components/image-ticker/LightboxOverlay.tsx",
      target: "image-ticker/LightboxOverlay.tsx",
      type: "component"
    }
  ],
  dependencies: ["framer-motion"],
  devDependencies: [],
  registryDependencies: [],
  requiresClient: true,
  supportsReducedMotion: true,
  usesWebGL: false,
  usesPointer: true,
  usesScroll: false,
  entry: "image-ticker/ImageTicker.tsx",
  exportName: "default",
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/image-ticker",
  previewUrl: "https://vectorvesper.dev/components/image-ticker"
} as const;
