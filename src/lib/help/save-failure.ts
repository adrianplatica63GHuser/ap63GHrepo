/**
 * Why a help text did not save — chosen from the route's status and the code in its body, never its raw text.
 *                                                                                                   (Slice 40.15)
 *
 * Adrian, 2026-10-21: „I have tried to accept the new changes inside the help information as I usually do; I get an
 * error cannot save". „Acceptă", „Acceptă toate" and the editor's „Salvează" dropped the response and said the same
 * thing whatever had happened, so the one report there was could not say whether the session, the rights, the screen,
 * the text or the database was at fault. Each failure now has its sentence (`help.admin.saveFailed.*`):
 *   - `signedOut`     — the request was sent to /login (the middleware's redirect) or answered 401;
 *   - `forbidden`     — 403, `requireFullAccess`'s „forbidden";
 *   - `unknownScreen` — 400 `unknown_screen`: the key is not in the registry;
 *   - `invalid`       — 400 `invalid_input`: the body is not the schema's shape;
 *   - `textChanged`   — 409 `text_changed`: a proposal sent the fingerprint it was written against, and the screen's text
 *                       is another one now — nothing was overwritten;
 *   - `database`      — 500 `database`, or 503 `role_unavailable` (the account's row could not be read);
 *   - `network`       — no answer at all: the fetch itself failed;
 *   - `other`         — anything else, with its status.
 *
 * PURE — `help-save.test.ts`. The fetch that uses it is `save-help-content.ts`.
 */

export type HelpSaveFailure = "signedOut" | "forbidden" | "unknownScreen" | "invalid" | "textChanged" | "database" | "network" | "other";

/** The codes the help routes put in an error body, beside `error` (which is for a reader of the log, not the screen). */
export const HELP_SAVE_CODE = {
  unknownScreen: "unknown_screen",
  invalid: "invalid_input",
  textChanged: "text_changed",
  database: "database",
} as const;

/** What the client keeps of a response: enough to choose the sentence, nothing it would show. */
export type HelpSaveResponse = {
  status: number;
  /** `opaqueredirect` when `redirect: "manual"` stopped at the middleware's redirect to /login. */
  type?: string;
  redirected?: boolean;
  url?: string;
};

function codeOf(body: unknown): string | null {
  if (body && typeof body === "object" && "code" in body) {
    const code = (body as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

function toLogin(res: HelpSaveResponse): boolean {
  if (res.type === "opaqueredirect") return true;
  if (!res.redirected || !res.url) return false;
  try {
    return new URL(res.url, "http://x").pathname === "/login";
  } catch {
    return false;
  }
}

/** The failure a non-2xx (or redirected) response stands for. */
export function helpSaveFailure(res: HelpSaveResponse, body: unknown): HelpSaveFailure {
  if (toLogin(res) || res.status === 401) return "signedOut";
  const code = codeOf(body);
  if (res.status === 403 || code === "forbidden") return "forbidden";
  if (code === HELP_SAVE_CODE.unknownScreen) return "unknownScreen";
  if (code === HELP_SAVE_CODE.invalid) return "invalid";
  if (res.status === 409 || code === HELP_SAVE_CODE.textChanged) return "textChanged";
  if (res.status === 503 || code === "role_unavailable" || code === HELP_SAVE_CODE.database) return "database";
  if (res.status === 500) return "database";
  return "other";
}

/** A failed save, as the mutations throw it: the failure and the status it came from (null for no answer). */
export class HelpSaveError extends Error {
  constructor(
    readonly failure: HelpSaveFailure,
    readonly status: number | null,
  ) {
    super(`help save failed: ${failure}${status === null ? "" : ` (${status})`}`);
    this.name = "HelpSaveError";
  }
}

/** The failure behind whatever a mutation threw — a `HelpSaveError`, or anything else as `network`. */
export function failureOf(err: unknown): { failure: HelpSaveFailure; status: number | null } {
  return err instanceof HelpSaveError ? { failure: err.failure, status: err.status } : { failure: "network", status: null };
}
