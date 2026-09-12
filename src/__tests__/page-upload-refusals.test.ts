/**
 * The bulk import's page-upload refusals reach the user in Romanian.
 *                                                               (Slice #34.20)
 *
 * The defect: `POST /api/documents/[id]/pages` answers a 415 and a 413 with an
 * ENGLISH `error` and — since Slice #34.06 — a machine `code` beside it.
 * `pages-panel.tsx`, whose dialog a user reaches directly, reads the code and
 * says the refusal in Romanian. `bulk-import-dialog.tsx` did not: `uploadPage`
 * is a module-level function with no translator, so it threw `body.error` and
 * the per-task catch wrote that English straight into a results-table cell and
 * into the saved HTML report. #34.06 recorded it as unreachable — CON-01/02/03
 * and CON-05 stop both refusals before a file is opened — and unreachable is
 * one constraint change away from being what a Romanian user reads for ever.
 *
 * Three things have to hold and none of them holds by itself:
 *
 *   1. the codes this app maps are the codes the ROUTE actually sends;
 *   2. the sentinel the throw writes is the sentinel the catch reads;
 *   3. the key the catch translates with exists in BOTH message files.
 *
 * Two of those cross a file boundary with nothing but a string literal to join
 * them, which is why the source-reading guards below are here at all. They are
 * BEHAVIOUR guards — comments are stripped before anything is matched — so a
 * docblock that says the right thing cannot make one pass.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { stripComments } from "@/lib/dev/strip-comments";
import {
  PAGE_REFUSALS,
  pageRefusalOfCode,
  pageRefusalOfSentinel,
} from "@/lib/import/page-upload-refusals";

const SRC = join(process.cwd(), "src");

/** A module's source with its comments removed — every guard here is a BEHAVIOUR guard. */
function codeOf(relPath: string): string {
  return stripComments(readFileSync(join(SRC, ...relPath.split("/")), "utf8"));
}

function messages(locale: "ro-RO" | "en-GB"): Record<string, unknown> {
  const raw = readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

/** The `adminImport.wizard.importDialog` block of a message file. */
function importDialogMessages(locale: "ro-RO" | "en-GB"): Record<string, string> {
  const root = messages(locale) as {
    adminImport: { wizard: { importDialog: Record<string, string> } };
  };
  return root.adminImport.wizard.importDialog;
}

const ROUTE = "app/api/documents/[id]/pages/route.ts";
const DIALOG = "app/admin/import/_components/bulk-import-dialog.tsx";
const PANEL = "app/documents/_components/pages-panel.tsx";

// ---------------------------------------------------------------------------
// The table itself
// ---------------------------------------------------------------------------

describe("the page-upload refusal table", () => {
  it("names the two refusals the route can produce, and no more", () => {
    expect(PAGE_REFUSALS.map((r) => r.code)).toEqual([
      "file_type_not_allowed",
      "file_too_large",
    ]);
  });

  it("gives every refusal a distinct code, sentinel and message key", () => {
    const distinct = (values: string[]) => new Set(values).size === values.length;
    expect(distinct(PAGE_REFUSALS.map((r) => r.code))).toBe(true);
    expect(distinct(PAGE_REFUSALS.map((r) => r.sentinel))).toBe(true);
    expect(distinct(PAGE_REFUSALS.map((r) => r.messageKey))).toBe(true);
  });

  /**
   * ⚠️ **THE PAIRING, ROW BY ROW — AND A THIRD ADVERSARIAL ROUND IS WHY THREE
   * COLUMNS BEING DISTINCT IS NOT ENOUGH.** Swapping the two `messageKey`s
   * preserves every property this file asserted: both codes present and in
   * order, all three columns distinct, both keys in both locales, the
   * `{limitMb}` placeholder on `pageFileTooLarge`, both sentences short. And it
   * produces the failure this repo's own pages route names as its worst: the
   * route's header says a 30 MB `.heic` refused for BEING a `.heic` must never
   * be told to scan again smaller, "advice that cannot work". A transposed
   * table writes exactly that into a permanent HTML report.
   */
  it("pairs each code with the message that answers it", () => {
    expect(pageRefusalOfCode("file_type_not_allowed")?.messageKey).toBe("pageFileTypeRefused");
    expect(pageRefusalOfCode("file_too_large")?.messageKey).toBe("pageFileTooLarge");
  });

  /**
   * And the same claim from the other side, said about the SENTENCES rather
   * than about the key names: only the size refusal may name a size, and it
   * must. A key list can be transposed; a placeholder cannot follow it.
   */
  it.each(["ro-RO", "en-GB"] as const)(
    "%s names a limit in the size refusal and in no other",
    (locale) => {
      const block = importDialogMessages(locale);
      for (const refusal of PAGE_REFUSALS) {
        const namesALimit = block[refusal.messageKey].includes("{limitMb}");
        expect(namesALimit).toBe(refusal.code === "file_too_large");
      }
    },
  );

  it("prefixes every sentinel so it can never collide with session-expired", () => {
    for (const refusal of PAGE_REFUSALS) {
      expect(refusal.sentinel.startsWith("page-")).toBe(true);
      expect(refusal.sentinel).not.toBe("session-expired");
    }
  });
});

describe("pageRefusalOfCode", () => {
  it("answers the refusal the route named", () => {
    expect(pageRefusalOfCode("file_type_not_allowed")?.sentinel).toBe("page-file-type-refused");
    expect(pageRefusalOfCode("file_too_large")?.sentinel).toBe("page-file-too-large");
  });

  /**
   * The fallback is the point of the null, not a gap in it: a 500, a proxy, or
   * a `code` the route grows later must leave the row carrying the route's own
   * English rather than a blank or a sentinel.
   */
  it("answers null for a body this client cannot name", () => {
    expect(pageRefusalOfCode(undefined)).toBeNull();
    expect(pageRefusalOfCode(null)).toBeNull();
    expect(pageRefusalOfCode("")).toBeNull();
    expect(pageRefusalOfCode("some_code_added_later")).toBeNull();
    expect(pageRefusalOfCode(415)).toBeNull();
    expect(pageRefusalOfCode({ code: "file_too_large" })).toBeNull();
  });
});

describe("pageRefusalOfSentinel", () => {
  it("answers the refusal a caught message names", () => {
    for (const refusal of PAGE_REFUSALS) {
      expect(pageRefusalOfSentinel(refusal.sentinel)).toBe(refusal);
    }
  });

  /**
   * `session-expired` travels the SAME catch and must never be read as a
   * refusal: it aborts the run and draws the sign-in banner, and a row that
   * reported it as "file over the limit" would send the user hunting a file.
   */
  it("does not claim session-expired, nor any other thrown message", () => {
    expect(pageRefusalOfSentinel("session-expired")).toBeNull();
    expect(pageRefusalOfSentinel("id-card-unreadable")).toBeNull();
    expect(pageRefusalOfSentinel("HTTP 500")).toBeNull();
    expect(pageRefusalOfSentinel("File type not allowed")).toBeNull();
    expect(pageRefusalOfSentinel(undefined)).toBeNull();
    expect(pageRefusalOfSentinel("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The three joins nothing else checks
// ---------------------------------------------------------------------------

describe("the codes are the route's own words", () => {
  const route = codeOf(ROUTE);

  it("finds the route to read", () => {
    expect(route).toContain("Response.json");
  });

  /**
   * ⚠️ The ROUTE is read, not this module's own constant. Renaming a code in
   * the route and forgetting this table is the failure that leaves the bulk
   * import silently back on English — the exact shape #34.06 left behind.
   */
  it("every code in the table is sent by the pages route", () => {
    for (const refusal of PAGE_REFUSALS) {
      expect(route).toContain(`code: "${refusal.code}"`);
    }
  });

  /**
   * And the reverse, so a code ADDED to the route cannot go unmapped.
   *
   * ⚠️ **ONE KNOWN HOLE, PINNED HERE RATHER THAN LEFT TO BE DISCOVERED.** This
   * reads inline string literals; `code: FILE_TOO_LARGE`, a code assembled from
   * a constant, is invisible to it and no source regex can close that. The
   * character class is deliberately wider than the two codes need — a capital
   * or a hyphen in a future code is caught, not skipped.
   */
  it("every code the route sends is in the table", () => {
    const sent = [...route.matchAll(/\bcode:\s*"([A-Za-z0-9_-]+)"/g)].map((m) => m[1]);
    expect(sent.length).toBeGreaterThan(0);
    expect([...new Set(sent)].sort()).toEqual(PAGE_REFUSALS.map((r) => r.code).sort());
  });

  /**
   * `pages-panel.tsx` maps the same two codes into its OWN namespace, for the
   * dialog a user reaches directly. It does not import this module — #34.20
   * deliberately left that client alone — so this is the only thing that would
   * notice the two drifting apart.
   */
  it("the other client maps the same two codes", () => {
    const panel = codeOf(PANEL);
    for (const refusal of PAGE_REFUSALS) {
      expect(panel).toContain(`"${refusal.code}"`);
    }
  });
});

describe("the sentinel the throw writes is the sentinel the catch reads", () => {
  const dialog = codeOf(DIALOG);

  it("finds the dialog to read", () => {
    expect(dialog).toContain("async function uploadPage(");
  });

  /** `uploadPage`'s own body, not the whole file. */
  const uploadPage = (() => {
    const at = dialog.indexOf("async function uploadPage(");
    if (at < 0) throw new Error("no uploadPage in the dialog");
    const next = dialog.indexOf("\n}", at);
    return dialog.slice(at, next);
  })();

  it("uploadPage turns the route's code into a sentinel", () => {
    expect(uploadPage).toContain("pageRefusalOfCode(body.code)");
    expect(uploadPage).toContain("throw new Error(refusal.sentinel)");
    expect(uploadPage).toMatch(/code\?:\s*string/);
  });

  /**
   * ⚠️ **THE SENTINEL THROW COMES FIRST, AND A SECOND ADVERSARIAL ROUND IS WHY
   * THE ORDER IS ASSERTED AT ALL.** The first draft checked only that both
   * throws appear somewhere in the function. Inserting
   * `if (body.error) throw new Error(body.error);` one line ABOVE the refusal
   * lookup — or simply swapping the two — passed every assertion and put the
   * route's English straight back into the row and into the permanent report,
   * which is the whole thing this slice removes. The English is the FALLBACK;
   * a fallback that runs first is not one.
   */
  it("reaches the English fallback only after the sentinel", () => {
    const sentinel = uploadPage.indexOf("throw new Error(refusal.sentinel)");
    const english = uploadPage.indexOf("throw new Error(body.error");
    expect(sentinel).toBeGreaterThan(0);
    expect(english).toBeGreaterThan(sentinel);
    // And nothing else throws in between, which is the other way to jump it.
    const between = uploadPage.slice(sentinel + 1, english);
    expect(between).not.toContain("throw ");
  });

  it("the per-task catch translates by sentinel", () => {
    expect(dialog).toContain("pageRefusalOfSentinel(msg)");
    expect(dialog).toContain("t(refusal.messageKey, { limitMb: MAX_UPLOAD_MB })");
  });

  /**
   * ⚠️ **THE HALF THAT ROTS.** Both ends going through the module is what makes
   * the string single-sourced; a literal `"page-file-too-large"` re-typed at
   * either end would pass every assertion above and still be the two-copies
   * shape this module exists to stop.
   */
  it("neither end writes a sentinel as a literal", () => {
    for (const refusal of PAGE_REFUSALS) {
      expect(dialog).not.toContain(`"${refusal.sentinel}"`);
      expect(dialog).not.toContain(`'${refusal.sentinel}'`);
    }
  });
});

describe("the message keys exist where the catch will look for them", () => {
  const locales = ["ro-RO", "en-GB"] as const;

  it.each(locales)("%s carries a sentence for every refusal", (locale) => {
    const block = importDialogMessages(locale);
    for (const refusal of PAGE_REFUSALS) {
      expect(typeof block[refusal.messageKey]).toBe("string");
      expect(block[refusal.messageKey].trim()).not.toBe("");
    }
  });

  /**
   * The catch passes `{ limitMb }` to every refusal because only one needs it.
   * next-intl ignores a value with no placeholder, but a MISSING placeholder on
   * the size refusal would print a limit-less sentence — "File over the limit"
   * — which is the one fact the row exists to give.
   */
  it.each(locales)("%s names the limit in the size refusal", (locale) => {
    expect(importDialogMessages(locale).pageFileTooLarge).toContain("{limitMb}");
  });

  /**
   * Short, and since Slice #34.23 the reason is the strongest it has been:
   * these sentences are PRINTED IN THE CELL, not only carried on its `title`
   * and into the permanent HTML report. A status column beside „Se importă…”
   * is a place for a label, and `reportRowFailed` — "nu a fost importat:
   * {reason}" — is a place for one too. See the module header, where #34.23
   * re-decided the register rather than inheriting it.
   *
   * ⚠️ **40 RATHER THAN 60, AND THE NUMBER IS NOW A COLUMN WIDTH.** #34.20 set
   * this at 60 for a tooltip, where nothing is too long. The cell is `w-40` —
   * 10rem — and the longest of these, „Fișier peste limita de {limitMb} MB",
   * is 35 characters and wraps to two lines there. 40 leaves a translator a
   * little room and keeps two lines as the ceiling; a sentence that needs more
   * than that needs the column resized in `bulk-import-dialog.tsx` in the same
   * commit, which is the point of failing here rather than on somebody's
   * screen.
   */
  it.each(locales)("%s keeps both refusals to the register of the status column", (locale) => {
    const block = importDialogMessages(locale);
    for (const refusal of PAGE_REFUSALS) {
      expect(block[refusal.messageKey].length).toBeLessThan(40);
    }
  });

  /**
   * And the one that is not a refusal but shares the cell with them. It was
   * written short for a `title` it turned out never to reach; #34.23 kept the
   * register deliberately rather than by omission, so it is pinned with them.
   */
  it.each(locales)("%s keeps sessionExpiredShort to the same register", (locale) => {
    expect(importDialogMessages(locale).sessionExpiredShort.length).toBeLessThan(40);
  });
});
