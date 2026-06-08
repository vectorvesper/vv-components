export const magneticButtonMetadata = {
  slug: "magnetic-button",
  name: "Magnetic Button",
  title: "Magnetic Button",
  description: "A button that pulls toward the mouse cursor when within range.",
  version: "1.0.0",
  tier: "free",
  category: "interaction",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/magnetic-button/MagneticButton.tsx",
      target: "magnetic-button/MagneticButton.tsx",
      type: "component"
    },
    {
      path: "packages/components/magnetic-button/types.ts",
      target: "magnetic-button/types.ts",
      type: "types"
    }
  ],
  dependencies: ["gsap"],
  devDependencies: [],
  registryDependencies: [],
  requiresClient: true,
  supportsReducedMotion: true,
  usesWebGL: false,
  usesPointer: true,
  usesScroll: false,
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/magnetic-button",
  previewUrl: "https://vectorvesper.dev/components/magnetic-button"
} as const;
