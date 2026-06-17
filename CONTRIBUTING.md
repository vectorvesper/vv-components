# Contributing to Vector Vesper Components

Thanks for helping improve the free Vector Vesper components! This repository is the
open-source home of the free component library — **issues and pull requests here are
welcome**.

## How this repo works (please read first)

This repository is the **published, open-source distribution** of Vector Vesper's free
components:

- `components/<slug>/` — the readable source for each free component (TSX, types, shaders).
- `r/` — the compiled registry the `vectorvesper` CLI and website fetch over HTTPS.
  **This is generated output — don't edit it by hand.**

The component **source of truth is a separate, internal build pipeline** (the registry
compiler and free/pro tooling). That means accepted code changes are **ported upstream by
a maintainer and re-synced back here** — your fix is credited and ships, but it's applied
through the build rather than merged file-for-file. In practice:

- ✅ Make your change in `components/<slug>/…` in your PR.
- ❌ Don't touch anything in `r/` — it's regenerated, so edits there are overwritten.
- A maintainer ports accepted PRs into the upstream source, bumps the component version,
  and the next sync publishes it here.

## Ways to contribute

- 🐛 **Report a bug** — [open an issue](https://github.com/vectorvesper/vv-components/issues)
  with the component slug, reproduction steps, and your framework (Next.js / Vite) + versions.
- 💡 **Request a component** — describe the effect; a short video, GIF, or CodePen helps a lot.
- 🔧 **Fix a component** — open a PR against `components/<slug>/` (see the flow above).
- 📝 **Improve docs or examples** — README, usage snippets, and code comments are fair game.

## Working on a component locally

There's no build step to run in this repo (the registry is generated upstream), so the way
to test a change is to drop the component into a real React app:

1. Create a React app — **Next.js (App Router)** or **Vite** — with Tailwind CSS and the
   component's dependencies (check the component's imports, e.g. `gsap` + `@gsap/react`, or
   `three` + `@react-three/fiber`).
2. Either copy your edited `components/<slug>/` source into the app
   (e.g. `src/components/vv/<slug>/`), or run `npx vectorvesper add <slug>` and edit in place.
3. Verify it renders and animates correctly, then open your PR with the updated source.

## Code style

Match the conventions of the existing components:

- Start client components with `"use client"`.
- **Stay hydration-safe** — no `Math.random()` during render. Use a seeded helper (see
  `SlimeButton`) so server- and client-rendered output match.
- **Give DOM/SVG ids `useId()`** (e.g. gooey filter ids) so multiple instances on one page
  don't collide.
- **Clean up GSAP** — use `useGSAP` / `contextSafe`, and remove listeners and tickers on unmount.
- TypeScript with explicit prop types and sensible defaults; avoid `any`.
- Keep components framework-agnostic — they must work on both Next.js and Vite.

## Pull request checklist

1. Fork and branch from `main`.
2. Edit only files under `components/<slug>/` (never `r/`).
3. Tested the component in a real React app.
4. Clear description, plus a before/after video or GIF for anything visual.
5. [Conventional Commits](https://www.conventionalcommits.org/) (`fix:`, `feat:`, `docs:`).

## Licensing

This repository is **MIT licensed**. By submitting a contribution you agree it can be
distributed under the repository's [MIT License](./LICENSE).

## Questions?

Open an [issue](https://github.com/vectorvesper/vv-components/issues) or visit
[vectorvesper.dev](https://vectorvesper.dev).
