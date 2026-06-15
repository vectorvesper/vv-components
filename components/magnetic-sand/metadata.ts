export const magneticSandMetadata = {
  slug: "magnetic-sand",
  name: "Magnetic Sand",
  title: "Magnetic Sand",
  description: "An interactive WebGL sand canvas particle field that deforms dynamically on pointer movement using React Three Fiber.",
  version: "1.0.0",
  tier: "free",
  category: "canvas",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/magnetic-sand/MagneticSand.tsx",
      target: "magnetic-sand/MagneticSand.tsx",
      type: "component"
    }
  ],
  dependencies: ["three", "@react-three/fiber"],
  devDependencies: [],
  registryDependencies: [],
  requiresClient: true,
  supportsReducedMotion: false,
  usesWebGL: true,
  usesPointer: true,
  usesScroll: false,
  entry: "magnetic-sand/MagneticSand.tsx",
  exportName: "default",
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/magnetic-sand",
  previewUrl: "https://vectorvesper.dev/components/magnetic-sand"
} as const;
