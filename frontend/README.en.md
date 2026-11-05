# vue3-vite-project · Four-Panel Engineering Base

[简体中文](./README.md) | **English**

> 📌 **Positioning** (verdict 2026-10-28, [docs/45](docs/45-仓库定位声明.md)): a single-maintainer opinionated engineering base — **code is public for reference, demo is playable online, but no template-level support is promised** (no npm packages, no community operations). Forks and borrowing are welcome; issues are accepted but responses are not guaranteed.

A Vue 3 engineering base covering **four panel forms in one codebase**: internal admin, public portal, mobile H5, and data big-screen. Feature-Sliced architecture, fully mockable without a backend.

> 🔀 **Single-app or Monorepo?** Insensitive to bundle size, few pages, or aiming for fast dev & deployment → pick the **single-app version** (`release/single` branch). Large project with many pages, sensitive to bundle size (per-app independent builds) → pick the **Monorepo multi-app version** (`release/monorepo` branch). Full comparison: [docs/48](docs/48-单应用模式与Monorepo多应用能力对比.md).

| Panel            | Entry        | Capability                                                                                                       |
| ---------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Admin (internal) | `/workbench` | `default` layout: sidebar + header + multi-tabs                                                                  |
| Portal (public)  | `/home`      | `portal` layout: top horizontal nav, no sidebar                                                                  |
| Mobile H5        | `/h5-demo`   | `h5` layout + rem adaptation ([docs/34](docs/34-H5布局与rem适配.md))                                             |
| Big screen       | `/big-demo`  | `big` layout + scale adaptation, 1920/2560/4K/9000px spliced screens ([docs/35](docs/35-大屏布局与scale适配.md)) |

## Tech Stack

Vue 3 (catalog `^3.5.38`, pinned to `3.6.0-beta.17` via pnpm overrides — back to stable before 2027-01-31, see pnpm-workspace.yaml) · TypeScript 6 (strict) · Vite 8 · Pinia 3 · Element Plus 2.14 · Vue Router 5 · UnoCSS 66 · pnpm 11

Node `^22.18 || >=24.12` · pnpm `>=11 <13` (enforced via `only-allow` preinstall)

## Quick Start

```bash
git clone <your-fork-url> my-project
cd my-project
pnpm install             # postinstall generates admin IDE type declarations (a few seconds)
pnpm -C apps/admin dev   # admin only (port 5174)
```

For a no-login demo, uncomment `# VITE_DEMO_NO_AUTH=true` at the end of `apps/admin/.env` (the file ships with the guide line), then open <http://localhost:5174> → straight to `/workbench`. (Single-app dev without it redirects to `/auth/login` — the auth app lives on a separate port, so a 404 there is expected. Cross-app login flow: `pnpm dev:gateway` → <http://localhost:8080/admin/>, log in with **admin / 123456**.)

After starting a real business module:

```bash
pnpm new-module order     # scaffolds 6 files + route, menu appears automatically
pnpm check:routes         # route consistency gate (same check as CI)
```

## Highlights

- **ProTable / XForm**: high-level table & low-code form engine with full event/slot contracts and unit tests
- **Four-panel adaptation**: mount a layout, write design-draft px — rem (H5) and scale (big screen) handled at compile/runtime layers
- **Engineering rigor**: 191 unit specs + 6 Playwright e2e; `type-check:full` / `lint` / `check:routes` / `check:aliases` / `check:doc-currency` all gate CI
- **State design**: httpOnly cookie auth (no token in localStorage), per-field store persistence, defensive UI three-state mandate

## Task Quick Reference

| I want to…                                          | Go to                                                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Get running in 30 minutes                           | [docs/10-新手指引.md](docs/10-新手指引.md) (Chinese)                                                              |
| Add a business module                               | `pnpm new-module <kebab-name>` → [docs/07](docs/07-路由模块设计.md)                                               |
| Build a table/form page                             | [docs/29-ProTable使用指南.md](docs/29-ProTable使用指南.md) / [docs/24-XForm使用指南.md](docs/24-XForm使用指南.md) |
| Add an H5 mobile page                               | [docs/34-H5布局与rem适配.md](docs/34-H5布局与rem适配.md) §1                                                       |
| Add a big-screen page                               | [docs/35-大屏布局与scale适配.md](docs/35-大屏布局与scale适配.md) §5                                               |
| Release / follow upstream after fork                | [docs/36-Fork升级与版本策略.md](docs/36-Fork升级与版本策略.md)                                                    |
| Decide where code belongs (utils/composable/store…) | [docs/18-代码组织决策表.md](docs/18-代码组织决策表.md) §2                                                         |

## Documentation

In-depth docs (35+) are **in Chinese** under [docs/](docs/) — the quick-reference table above is the entry point. Architecture decisions: [docs/37](docs/37-h5-rem适配决策记录.md) / [docs/38](docs/38-big-scale适配决策记录.md) (h5 rem & big scale ADRs).

## License & Versioning

MIT © 2026 Mr.Mickey (Mr-Super-X) — see [LICENSE](./LICENSE).
Versioning and fork-upgrade strategy: [docs/36](docs/36-Fork升级与版本策略.md).
