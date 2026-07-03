export const mediaShaderMetadata = {
  slug: "media-shader",
  name: "Media Shader",
  title: "Media Shader",
  description: "An ultra-premium WebGL-based media distortion component that creates beautiful interactive liquid chromatic ripples, wave physics, and refractions on images or videos on hover.",
  version: "1.0.0",
  tier: "free",
  category: "visual",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/media-shader/index.ts",
      target: "media-shader/index.ts",
      type: "component"
    },
    {
      path: "packages/components/media-shader/MediaShader.tsx",
      target: "media-shader/MediaShader.tsx",
      type: "component"
    }
  ],
  dependencies: [],
  devDependencies: [],
  registryDependencies: [],
  requiresClient: true,
  supportsReducedMotion: true,
  usesWebGL: true,
  usesPointer: true,
  usesScroll: false,
  entry: "media-shader/index.ts",
  exportName: "ShaderImage",
  usesTailwind: true,
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/media-shader",
  previewUrl: "https://vectorvesper.dev/components/media-shader"
} as const;
