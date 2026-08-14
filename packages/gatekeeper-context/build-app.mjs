// Build the Context Library SPA into generated single-file HTML for startAppUi().

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = resolve(fileURLToPath(import.meta.url), "..");
const watch = process.argv.includes("--watch");

console.log(
  watch
    ? "watching context library app for changes…"
    : "building context library app single-file bundle…",
);
execFileSync(
  "pnpm",
  ["exec", "vite", "build", "-c", "vite.config.ts", ...(watch ? ["--watch"] : [])],
  // shell: true is required on Node 22+ Windows: CVE-2024-27980 hardened child_process spawn,
  // which refuses to spawn .cmd/extension-less shims from PATH without delegating to cmd.exe.
  { cwd: pkgDir, stdio: "inherit", shell: true },
);
