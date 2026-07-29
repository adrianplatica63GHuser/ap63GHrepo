/**
 * Playwright configuration — E2E versioning suite  (Slice #19.28)
 *
 * Targets the local dev server at http://localhost:3000.
 * Run: npm run e2e          (headless)
 *      npm run e2e:ui        (interactive UI mode)
 *
 * Pre-conditions:
 *   - Dev server running:  npm run dev
 *   - .env has E2E_EMAIL and E2E_PASSWORD set
 *
 * Two projects:
 *   "setup"    — auth.setup.ts: logs in once, creates the fixed E2E property,
 *                saves session cookies to e2e/.auth/session.json
 *   "chromium" — all specs, depends on "setup", reuses the saved session
 *
 * Sequential execution (workers: 1) because all versioning specs share the
 * same fixed property row and must not run in parallel.
 */

import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";

// Playwright does not auto-load .env (Next.js does — Playwright does not).
// Parse the file with a minimal built-in reader so no extra package is needed.
const dotenvPath = path.join(__dirname, ".env");
if (fs.existsSync(dotenvPath)) {
  for (const line of fs.readFileSync(dotenvPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

export const AUTH_FILE = path.join(__dirname, "e2e/.auth/session.json");

export default defineConfig({
  testDir: "./e2e",

  // Sequential — specs share one fixed property, cannot run in parallel
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: 0,

  reporter: "list",

  use: {
    baseURL: "http://localhost:3000",
    // Keep a trace for easier debugging when a test fails
    trace: "retain-on-failure",
  },

  projects: [
    // ── 1. Global auth setup ────────────────────────────────────────────────
    // Runs first; no storageState — it IS the thing that creates the state.
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },

    // ── 2. All E2E specs ─────────────────────────────────────────────────────
    // Depend on "setup"; use the saved session so every spec starts logged in.
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_FILE,
      },
      dependencies: ["setup"],
    },
  ],
});
