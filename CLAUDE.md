# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Cloudflare OS v2** — an open-source "operating system" for AI productivity, built by Cloudflare on top of Workers, Durable Objects, Dynamic Workers, and Facets. Users build "Gadgets" (personal sandboxed apps) and converse with an agent that can access external services via "Gatekeepers" (capability-based MCP-style workers).

This is an **early access** rewrite of v1. Heavy development; the API surface changes frequently.

## Essential Reading

- **`AGENTS.md`** — extensive project-specific conventions (RPC patterns, kernel review bar, logging, TypeScript 7 caveats, test/lint caching behavior, etc.). Treat it as required reading for non-trivial changes; many "obvious" approaches are explicitly prohibited there.
- **`README.md`** — product overview, OS analogy (kernel/shell/devices/processes), and deployment options.
- **`packages/workshop-shared/src/api.ts`** — the canonical RPC API surface.
- **`packages/workshop-shared/node_modules/capnweb/README.md`** — Cap'n Web RPC semantics, especially **promise pipelining**.
- Per-package READMEs (e.g. `packages/gatekeeper-*/README.md`) for gatekeeper-specific setup.

## High-Level Architecture

Monorepo (pnpm workspaces). The OS analogy in `README.md` maps cleanly to packages:

| OS concept    | Package                          |
|---------------|----------------------------------|
| kernel        | `packages/workshop-backend`      |
| shell         | `packages/workshop-frontend`     |
| device driver | `packages/gatekeeper-*`          |
| public origin | `packages/router`                |

Other notable packages:

- **`packages/workshop-shared`** — RPC interface (Cap'n Web) shared by frontend and backend. Doc-comment **every** exported member (types, consts, functions). Reviewers read this and `workshop-backend` line-by-line; diffs here should be small and elegant.
- **`packages/mcp-shared`** — Library (not a Worker) shared by `gatekeeper-mcp` and `gatekeeper-mcp-portal`.
- **`packages/backend-utils`** — Server-side logger, observability context, error reporting helpers.
- **`packages/typed-storage`** — The only package that emits declarations (sets `rootDir` for TS 7).
- **`packages/configurator-ui`** — Type-only component helpers for gatekeeper configurator UIs (compiled by `scripts/build-gatekeeper-configurator.mjs`).
- **`packages/integration-tests`** — Integration test toolkit; holds its own capnweb copy to avoid a stub-serialisation bug when consumed as a submodule.

Frontend ↔ backend communication is a persistent WebSocket carrying Cap'n Web RPC. Gadget server code runs in Dynamic Worker Facets with no internet egress by default; gadget client code runs in a sandboxed iframe that talks to the server only via `postMessage`-mediated Cap'n Web.

## Commands

`pnpm` only. The toolchain config (wrangler, vite, vitest, typescript) is centralized in `pnpm-workspace.yaml` `catalog:`; bump there, not in package files.

| Task                          | Command                                           |
|-------------------------------|---------------------------------------------------|
| Run locally (full stack)      | `pnpm run-local` → http://localhost:8787          |
| Dev (split)                   | `pnpm dev-server` + `pnpm dev-client` (port 3000) |
| Type-check / codegen          | `pnpm build`                                      |
| Run tests                     | `pnpm test`                                       |
| Lint + type-check             | `pnpm lint`                                       |
| Lint only                     | `pnpm lint:check`                                 |
| Lint autofix                  | `pnpm lint:fix`                                   |
| Generate worker binding types | `pnpm types:generate`                             |

`build`, `test`, and `clean` are `vp run -r` (Vite+), not `pnpm run --recursive`. Vite+ caches each task against its inputs; `vp run --last-details` explains every hit/miss — read it when a build seems slow. Re-runs with no changes are dramatically faster than first runs.

## Conventions Worth Flagging Upfront

- **Use RPC promise pipelining.** Awaiting is often unnecessary; a `RpcPromise` can be passed as an argument to another call, and the server resolves it before the call runs. See `AGENTS.md` and the capnweb README.
- **Don't put raw RPC stubs in `useState`.** Wrap them in an object — the setter invokes callable arguments otherwise.
- **Dispose stubs.** Use `stub[Symbol.dispose]()` or `using { ... }`, especially in React `useEffect` cleanups.
- **Server logging** goes through `@gadgets/backend-utils/logger` with a module-scoped logger (`component: "package.subsystem"`, plus `vendorId` for gatekeepers). Never log secrets/prompts/tokens/bodies.
- **Frontend error reporting** is opt-in via `VITE_FRONTEND_ERROR_REPORTING=true` and only enabled for trusted first-party surfaces — never install it in gadget/user code.
- **TypeScript 7 (tsgo) has no JS compiler API.** Use the `typescript6` alias (`npm:typescript@6.0.3`) for `transpileModule`/`createProgram`. `import type` from `typescript` is fine.
- **No `baseUrl` in tsconfig.** TS 7 removed it; `paths` entries are explicit relative paths anyway.
- **`workshop-backend` is the kernel.** Capability-based security is the model: a resource becomes "ambient" only via user/admin configuration — a gatekeeper must never assert its own ambience. The single chokepoint is `user.ts:getGatekeeperClassFor()`.

## Linting

Single config: `lint` block in `vite.config.ts` (no `.oxlintrc.json`). Vite+ pins oxlint 1.76.0. Plugins: typescript, unicorn, oxc, import (+ react/jsx-a11y in frontend, + vitest in tests). Custom rule `gadgets/prefer-jsdoc` enforces JSDoc on exported API members.

Type-aware oxlint rules are **not enabled** — the tsgo pass would dominate runtime and `no-floating-promises` conflicts with deliberate unawaited RPC pipelining. Type safety is enforced by `tsc` via `pnpm build` / `pnpm lint`.

## Tests

`pnpm test` runs `node --test scripts/*.test.js` first, then `vp run -r --cache test`. As of this writing most packages don't have tests. The five workerd-backed packages (`router`, `typed-storage`, `backend-utils`, `workshop-backend`, `gatekeeper-scheduler`) load `test-setup/assert-workerd.ts` as a `setupFiles` entry that throws unless `navigator.userAgent === "Cloudflare-Workers"` — don't remove it; without it a broken pool falls back to Node and silently produces green tests.

Test concurrency is capped at 2: workerd children that OOM (exit 137) wedge the vitest parent instead of failing, and it reproduced at concurrency 4.

## Contribution Policy

Per `CONTRIBUTING.md`, **outside contributions are not being accepted** at this time. Small trivially-verified PRs may be considered; PRs over a dozen lines will be closed. Open a discussion for larger ideas.