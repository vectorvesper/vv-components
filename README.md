<p align="center">
  <img src="https://vectorvesper.dev/logo.svg" width="80" alt="Vector Vesper" />
</p>

<h1 align="center">Vector Vesper</h1>

<p align="center">
  <strong>Premium WebGL & React visual components — delivered via CLI.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/vectorvesper"><img src="https://img.shields.io/npm/v/vectorvesper?style=flat-square&color=7c3aed" alt="npm version" /></a>
  <a href="https://github.com/vectorvesper/vv-components/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square" alt="Node.js >=18" />
</p>

<p align="center">
  <a href="https://vectorvesper.dev">Website</a> ·
  <a href="https://vectorvesper.dev/components">Components</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#available-components">Browse Components</a>
</p>

---

## What is Vector Vesper?

Vector Vesper is a curated collection of **production-ready visual components** for React. Think magnetic cursors, WebGL particle effects, 3D galleries, and scroll-driven animations — all installable with a single CLI command.

**No bloated npm packages.** Components are copied directly into your project (like shadcn/ui), so you own the code and can customize everything.

---

## Quick Start

```bash
# Initialize Vector Vesper in your project
npx vectorvesper init

# Add a component
npx vectorvesper add magnetic-button

# That's it — import and use!
```

```tsx
import { MagneticButton } from "@/components/vv/magnetic-button/MagneticButton";

export default function App() {
  return <MagneticButton>Hover me</MagneticButton>;
}
```

---

## Available Components

| Component | Category | Description | WebGL |
|-----------|----------|-------------|:-----:|
| [`magnetic-button`](components/magnetic-button) | Interaction | A button that pulls toward the cursor on hover | — |
| [`magnetic-cursor`](components/magnetic-cursor) | Interaction | Custom magnetic cursor follower | — |
| [`glass-gallery`](components/glass-gallery) | 3D Gallery | Frosted-glass 3D image gallery | ✦ |
| [`scroll-highlighter`](components/scroll-highlighter) | Typography | Physics-based scroll text animation | ✦ |
| [`code-rain`](components/code-rain) | Visual | Matrix-style code rain effect | ✦ |
| [`image-ticker`](components/image-ticker) | Visual | Smooth infinite image ticker | — |
| [`magnetic-sand`](components/magnetic-sand) | Visual | Magnetic sand particle effect | ✦ |

> **✦ WebGL** — These components use Three.js / React Three Fiber for GPU-accelerated rendering.

---

## CLI Commands

```
vv init                Initialize VV config in your project
vv list                Browse all available components
vv add <slug>          Add a component to your project
vv add <slug> --dry-run  Preview what will be installed
vv info                Show project diagnostics
vv diff [slug]         Check for component updates
vv login <key>         Authenticate for pro components
vv logout              Clear saved credentials
vv whoami              Show current auth status
```

---

## How It Works

```
┌─────────────┐      fetch JSON       ┌──────────────────┐
│   vv CLI    │ ───────────────────▶  │  This repository  │
│ (your shell)│                       │  (static registry) │
└─────┬───────┘                       └──────────────────┘
      │
      ▼ writes files
┌─────────────────┐
│  Your Project   │
│  src/components/ │
│  vv/magnetic-*   │
└─────────────────┘
```

No server. No runtime dependency. The CLI reads static JSON files from this repository and writes component source code directly into your project.

---

## Project Structure

```
vv-components/
├── components/          # Raw component source files
│   ├── magnetic-button/
│   ├── glass-gallery/
│   ├── code-rain/
│   └── ...
├── r/                   # Compiled registry (JSON)
│   ├── registry.json    # Component index
│   ├── magnetic-button.json
│   └── ...
├── LICENSE
└── README.md
```

---

## Contributing

We welcome contributions! Please see the [Contributing Guide](https://github.com/vectorvesper/vector-vesper/blob/main/CONTRIBUTING.md) in the main repository.

---

## License

[MIT](./LICENSE) © Vector Vesper
