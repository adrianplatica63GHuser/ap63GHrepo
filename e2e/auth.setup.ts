/**
 * Global auth setup for E2E tests  (Slice #19.28)
 *
 * Runs once per `playwright test` invocation (before any spec):
 *   1. Logs in via /login with E2E_EMAIL + E2E_PASSWORD from .env and saves the
 *      session (cookies + localStorage) to e2e/.auth/session.json.
 *   2. Creates a fixed "E2E Proprietate Test" property on the very first run and
 *      caches its UUID in e2e/.auth/e2e-ids.json.  Subsequent runs reuse the same
 *      property so version history accumulates on one DB row instead of creating
 *      new rows on every run.
 *
 * The saved storageState is picked up automatically by every spec via
 * playwright.config.ts `use: { storageState: AUTH_FILE }`.
 *
 * Required .env entries (see .env.example):
 *   E2E_EMAIL     — email address of the test user account
 *   E2E_PASSWORD  — password for the test user account
 */

import { test as setup, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const AUTH_DIR  = path.join(__dirname, ".auth");
const AUTH_FILE = path.join(AUTH_DIR, "session.json");
const IDS_FILE  = path.join(AUTH_DIR, "e2e-ids.json");

setup("autentificare si pregatire fixture E2E", async ({ page }) => {
  // Ensure the cache directory exists
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // ── 1. Login ──────────────────────────────────────────────────────────────
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_EMAIL and E2E_PASSWORD must be set in .env to run E2E tests.\n" +
        "See .env.example for the required entries.",
    );
  }

  await page.goto("/login");

  await page.fill("#identity", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');

  // The login form calls router.push("/") — a Next.js App Router client-side
  // navigation via pushState.  The browser "load" event never fires for a
  // pushState navigation, so the default waitUntil:"load" would time out.
  // Use waitUntil:"commit" which resolves as soon as the URL changes.
  await page.waitForURL("/", { timeout: 20_000, waitUntil: "commit" });

  // Brief stabilisation — ensure the middleware doesn't redirect us back to
  // /login (can happen if the Supabase auth cookie was not written before the
  // first RSC request fired for "/").
  await page.waitForTimeout(1_500);
  if (page.url().includes("/login")) {
    throw new Error(
      "Login failed — redirected back to /login after auth.\n" +
        `Check E2E_EMAIL (${email}) and E2E_PASSWORD in .env.`,
    );
  }

  // Set Romanian locale for all specs — UI strings must be Romanian
  await page.context().addCookies([
    {
      name:   "NEXT_LOCALE",
      value:  "ro-RO",
      domain: "localhost",
      path:   "/",
    },
  ]);

  // Persist the session so every spec starts authenticated
  await page.context().storageState({ path: AUTH_FILE });

  // ── 2. Create or reuse the fixed E2E test property ───────────────────────
  // The property accumulates versions across runs — that is intentional and
  // harmless.  All test assertions are relative (+1 / -1 from startVersion)
  // so they stay correct regardless of how many versions exist.

  let propertyId: string | undefined;

  if (fs.existsSync(IDS_FILE)) {
    try {
      const cached = JSON.parse(
        fs.readFileSync(IDS_FILE, "utf-8"),
      ) as { propertyId: string };
      propertyId = cached.propertyId;

      // Verify the property still exists (not soft-deleted or DB-reset)
      const check = await page.request.get(`/api/properties/${propertyId}`);
      if (!check.ok()) {
        console.log("[E2E setup] Cached property not found — will create a new one.");
        propertyId = undefined;
      }
    } catch {
      propertyId = undefined;
    }
  }

  if (!propertyId) {
    const res = await page.request.post("/api/properties", {
      data: { nickname: "E2E Proprietate Test" },
    });
    expect(
      res.ok(),
      `POST /api/properties failed (${res.status()}) — check E2E_EMAIL/E2E_PASSWORD and that the dev server is running`,
    ).toBeTruthy();

    // POST /api/properties returns PropertyFull: { property: { id, ... }, address, corners }
    const body = (await res.json()) as { property: { id: string } };
    propertyId = body.property.id;
    console.log(`[E2E setup] Created E2E property: ${propertyId}`);
  } else {
    console.log(`[E2E setup] Reusing E2E property: ${propertyId}`);
  }

  fs.writeFileSync(IDS_FILE, JSON.stringify({ propertyId }, null, 2));
});
