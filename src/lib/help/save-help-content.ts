/**
 * The one PUT behind „Salvează", „Acceptă" and „Acceptă toate" in „Informații de ajutor".          (Slice 40.15)
 *
 * Three copies of the same fetch dropped the response; this one keeps what it needs to say why (`save-failure.ts`):
 *   - `redirect: "manual"`, so a session that has ended stops at the middleware's redirect instead of following it to
 *     /login with the PUT — which answered something that is not the route's;
 *   - `against`, sent by a proposal: the fingerprint it was written against, so the route refuses (409) a screen whose
 *     text changed since, rather than overwriting it — one „Acceptă" as safe as „Acceptă toate";
 *   - one more try, after `Retry-After` (at most 5 s), on a 503: `requireFullAccess` answers 503 when the account's
 *     row could not be read for a moment, and says so with that header.
 */
import { HelpSaveError, helpSaveFailure } from "./save-failure";
import type { HelpTexts } from "./proposals";

const RETRY_CAP_MS = 5_000;

function retryAfterMs(res: Response): number {
  const s = Number(res.headers.get("Retry-After"));
  return Number.isFinite(s) && s > 0 ? Math.min(s * 1_000, RETRY_CAP_MS) : 1_000;
}

async function bodyOf(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Saves one screen's four texts. Resolves with the route's body; rejects with a `HelpSaveError` that names the failure.
 * `wait` is for the tests, which do not sleep.
 */
export async function saveHelpContent(
  screenKey: string,
  texts: HelpTexts,
  against?: string,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<unknown> {
  const send = () =>
    fetch(`/api/admin/help-content/${encodeURIComponent(screenKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(against === undefined ? texts : { ...texts, against }),
      redirect: "manual",
    });
  let res: Response;
  try {
    res = await send();
    if (res.status === 503) {
      await wait(retryAfterMs(res));
      res = await send();
    }
  } catch {
    throw new HelpSaveError("network", null);
  }
  if (res.ok && res.type !== "opaqueredirect") return bodyOf(res);
  throw new HelpSaveError(helpSaveFailure(res, await bodyOf(res)), res.type === "opaqueredirect" ? null : res.status);
}
