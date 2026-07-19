<div align="center">

<img src="https://www.vectorvesper.dev/icon.svg" width="84" alt="Vector Vesper" />

# Vector Vesper

### The motion toolkit for React.

[![npm](https://img.shields.io/npm/v/vectorvesper?style=flat-square&color=7EACB5&label=vectorvesper)](https://www.npmjs.com/package/vectorvesper)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org)

[**Website**](https://vectorvesper.dev) · [**Live Previews**](https://vectorvesper.dev/components) · [**Quick Start**](#-quick-start) · [**Components**](#-components) · [**Pro Releases**](https://vectorvesper.dev/pricing)

</div>

---

## Why Vector Vesper

- **Built to ship — Ready for production.** Every release is built as shipping code with TypeScript props, practical documentation, and APIs developers can work with under deadline.
- **Time saved — Faster than custom motion work.** Teams usually lose days rebuilding motion systems from scratch. Vector Vesper gives you working foundations that you can adapt in code and ship under your own brand.
- **React-first — Works with Next.js and Vite.** Built for product teams, agencies, freelancers, and founders shipping React sites.
- **Full control — Own the source.** You get the source for components, motion logic, and shaders. Adapt it to your brand, your stack, and your performance budget.
- **Designed to matter — Creative depth with engineering discipline.** Vector Vesper focuses on motion that changes how a page feels and reads. The work goes beyond decoration and stays grounded in usable engineering.
- **Growing toolkit — July roadmap.** Current releases cover shaders and GPU pixel systems. July expands the toolkit with page transitions, GSAP motion, workflows, and helper resources.

---

## 🚀 Quick Start

```bash
# 1. Initialize Vector Vesper in your React / Next.js / Vite project
npx vectorvesper@latest init

# 2. Add a component (you'll be prompted to install any missing deps)
npx vectorvesper add physics-buttons
```

Prefer a short command? Install once and use the `vv` binary:

```bash
npm i -g vectorvesper
vv add glass-gallery
```

### Use it

```tsx
// Plain interactive component — import and go.
import { JellyButton } from "@/components/vv/physics-buttons";

export default function CTA() {
  return <JellyButton>Get started</JellyButton>;
}
```

```tsx
// WebGL component on Next.js — the CLI prints this exact snippet for you.
"use client";
import dynamic from "next/dynamic";

const GlassGallery = dynamic(
  () => import("@/components/vv/glass-gallery"),
  { ssr: false }
);

export default function Hero() {
  return <GlassGallery /* props documented at vectorvesper.dev */ />;
}
```

---

## 🧱 Components

| Component | Category | Stack | Description |
|-----------|----------|-------|-------------|
| [`code-rain`](components/code-rain) | Canvas | R3F · WebGL | Interactive matrix code-rain that reacts to clicks and typing |
| [`glass-gallery`](components/glass-gallery) | 3D Gallery | R3F · WebGL | Frosted-glass 3D gallery that disassembles into a collage on scroll |
| [`image-ticker`](components/image-ticker) | Visual | Framer Motion | Infinite dual image ticker with built-in lightbox |
| [`magnetic-sand`](components/magnetic-sand) | Canvas | R3F · WebGL | Magnetic sand particle field that deforms on pointer move |
| [`physics-buttons`](components/physics-buttons) | Button | GSAP | Four spring-physics action buttons — slime, elastic, jelly, impact |
| [`scroll-highlighter`](components/scroll-highlighter) | Typography | Framer Motion | Word-by-word scroll-driven text highlighter |

> Browse interactive previews at **[vectorvesper.dev/components](https://vectorvesper.dev/components)** · run `npx vectorvesper list` for the latest set.

---

## 🛠️ CLI Reference

```
npx vectorvesper init                Initialize VV config in your project
npx vectorvesper list                Browse all available components
npx vectorvesper add <slug>          Add a component (prompts to install deps)
npx vectorvesper add <slug> --dry-run  Preview what will be written
npx vectorvesper update [slug]       Update components to the latest version
npx vectorvesper remove <slug>       Remove a component and its files
npx vectorvesper info                Show project diagnostics
npx vectorvesper diff [slug]         Check for component updates
npx vectorvesper login <key>         Authenticate for pro releases
npx vectorvesper logout              Clear saved credentials
npx vectorvesper whoami              Show current access status
```

Useful flags: `--overwrite` / `-o`, `--yes` / `-y`, `--no-install`, `--force` / `-f`.

---

## ⚙️ How It Works

No server, no runtime SDK. The CLI fetches versioned JSON from this repo, writes the source into your project, and records what it installed in `vv-manifest.json` so `update` and `diff` work later.

---

## 📋 Requirements

- **Node.js** ≥ 18
- **React** 18 or 19
- **Next.js** (App or Pages Router) or **Vite**
- For WebGL components: **three**, **@react-three/fiber** (the CLI installs these for you)

---

## 🗺️ Roadmap & Pro Releases

The free components here are the on-ramp. Paid releases ship as **one-time, lifetime-license** drops:

- **Shader Collection** — five GLSL shader systems + production React implementations
- **Pixel Patterns** — 50+ GPU pixel effects (patterns, text, image modes) with a typed prop API
- **VV Toolkit (July 2026)** — the full kit: page transitions, GSAP motion, SVG animation, and helper resources

Explore them at **[vectorvesper.dev/pricing](https://vectorvesper.dev/pricing)**. 
---


## 🤝 Contributing

Contributions to the free components are welcome. See the **[Contributing Guide](./CONTRIBUTING.md)** for how it works.

Found a bug or have a request? [Open an issue](https://github.com/vectorvesper/vv-components/issues).

---

## Support

- **Docs & previews:** [vectorvesper.dev](https://vectorvesper.dev)
- **X / Twitter:** [@Shivanidas0910](https://x.com/Shivanidas0910)
- **Email:** [support@vectorvesper.dev](mailto:support@vectorvesper.dev)
- **Issues:** [github.com/vectorvesper/vv-components/issues](https://github.com/vectorvesper/vv-components/issues)

---

<div align="center">

**[MIT](./LICENSE)** © Vector Vesper · *Motion, Engineered.*

</div>
