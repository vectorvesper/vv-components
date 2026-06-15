export const scrollHighlighterMetadata = {
  slug: "scroll-highlighter",
  name: "Scroll Highlighter",
  title: "Scroll Highlighter",
  description: "A premium typography scroll-highlighter that highlights text word-by-word with solid, wavy, or dotted styles based on page scroll or custom motion values.",
  version: "1.0.0",
  tier: "free",
  category: "interaction",
  type: "vv:component",
  frameworks: ["next", "vite"],
  files: [
    {
      path: "packages/components/scroll-highlighter/index.ts",
      target: "scroll-highlighter/index.ts",
      type: "component"
    },
    {
      path: "packages/components/scroll-highlighter/ScrollHighlighter.tsx",
      target: "scroll-highlighter/ScrollHighlighter.tsx",
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
  usesScroll: true,
  entry: "scroll-highlighter/index.ts",
  exportName: "default",
  fallbacks: [],
  recipes: [],
  docsUrl: "https://vectorvesper.dev/components/scroll-highlighter",
  previewUrl: "https://vectorvesper.dev/components/scroll-highlighter"
} as const;
