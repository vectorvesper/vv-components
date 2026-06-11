export const codeRainMetadata = {
  slug: "code-rain",
  name: "Code Rain",
  title: "Code Rain",
  description: "An interactive WebGL matrix digital rain canvas that reacts to mouse clicks and keypress typing bursts.",
  version: "1.0.0",
  tier: "free",
  category: "canvas",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/code-rain/CodeRain.tsx",
      target: "code-rain/CodeRain.tsx",
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
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/code-rain",
  previewUrl: "https://vectorvesper.dev/components/code-rain"
} as const;
