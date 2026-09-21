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
import net from "net";
import path from "path";

const AUTH_DIR  = path.join(__dirname, ".auth");
const AUTH_FILE = path.join(AUTH_DIR, "session.json");
const IDS_FILE  = path.join(AUTH_DIR, "e2e-ids.json");

/**
 * Is the dev server there, and has it finished compiling the first route?
 *                                                              (Slice #35.05)
 *
 * ⚠️ **THIS EXISTS BECAUSE THE THREE FAILURES LOOK IDENTICAL FROM `page.goto`,
 * AND TWO OF THEM ARE NOT THE USER'S FAULT.** Playwright's default test timeout
 * is 30 s and `playwright.config.ts` declares no `webServer`, so the whole
 * sequence is: navigate, wait, get killed at 30 s, and report
 * `net::ERR_ABORTED; maybe frame was detached?` — a message that names neither
 * the port nor the reason. The three states behind it are:
 *
 *   1. nothing listening on the port — `npm run dev` was never started, or died;
 *   2. listening, and still compiling the first route — `next dev` compiles on
 *      demand, and the FIRST request after a cold start routinely takes longer
 *      than 30 s on this app, so a perfectly healthy server fails the run;
 *   3. listening, and the compile has hung — the observed case: the server's own
 *      `.next/dev/logs/next-development.log` ended at "○ Compiling /login ..."
 *      with no "✓ Compiled" line and nothing written into `.next` five minutes
 *      later.
 *
 * ⚠️ **THE PORT IS PROBED AT THE TCP LEVEL, NOT WITH `fetch`, AND THAT IS THE
 * WHOLE POINT.** An HTTP probe cannot separate (1) from (2): a server that is up
 * but has not compiled `/` yet leaves a `fetch` hanging exactly as a dead port
 * does on Windows, where a connection to a port nothing is listening on is
 * commonly dropped rather than refused. A TCP connect answers in milliseconds
 * and answers the right question.
 *
 * It reports rather than repairs: every branch throws a sentence naming what to
 * do. Nothing here restarts a server or deletes a cache — the run is a
 * verification step, and a verification step that silently fixes its own
 * preconditions is one nobody can trust.
 */
const CONNECT_PROBE_MS = 3_000;
const FIRST_COMPILE_BUDGET_MS = 120_000;

function portIsOpen(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const done = (open: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function requireDevServer(baseURL: string): Promise<void> {
  const url = new URL(baseURL);
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));

  if (!(await portIsOpen(url.hostname, port, CONNECT_PROBE_MS))) {
    throw new Error(
      `No TCP connection to ${url.origin} — nothing is listening on port ${port}.\n` +
        "The E2E suite does not start the application (playwright.config.ts declares no `webServer`).\n" +
        "Start it first, in its own terminal:  npm run dev",
    );
  }

  // The port is open, so the only question left is whether the first route has
  // been compiled. `next dev` compiles on demand; until it finishes, the
  // request simply does not come back.
  const started = Date.now();
  try {
    await fetch(new URL("/login", url).toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(FIRST_COMPILE_BUDGET_MS),
    });
  } catch {
    const waited = Math.round((Date.now() - started) / 1000);
    throw new Error(
      `${url.origin} accepted the connection but did not answer GET /login within ${waited}s.\n` +
        "The dev server is running and its first compile has not finished. Read its own log:\n" +
        "  .next/dev/logs/next-development.log\n" +
        'A healthy cold start ends with "✓ Compiled /login"; a run that stops at "○ Compiling /login ..."\n' +
        "and writes nothing further into .next has hung — stop the server, delete .next, and start it again.",
    );
  }
}

setup("autentificare si pregatire fixture E2E", async ({ page, baseURL }) => {
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

  // ⚠️ Before the first navigation, not after it — see `requireDevServer`.
  // A dead port, a cold compile and a hung compile are one message from
  // `page.goto`, and two of the three are not a problem with this test.
  //
  // ⚠️ `baseURL` is the FIXTURE, not a literal: it is `use.baseURL` from
  // playwright.config.ts, which is also what `page.goto("/login")` resolves its
  // relative path against. A second copy of the URL here would be a probe that
  // can pass against a server the navigation never visits.
  if (!baseURL) throw new Error("playwright.config.ts must set use.baseURL.");
  await requireDevServer(baseURL);

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

      // Verify the property still exists (not deleted or DB-reset)
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
