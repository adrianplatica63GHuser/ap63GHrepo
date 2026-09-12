/**
 * A failed import row says WHY when the run can name a reason, and „Eroare”
 * when it cannot.                                                (Slice #34.23)
 *
 * The defect #34.20 handed over, in its own words: „The import results cell
 * shows „Eroare” and nothing else. `errorMsg` reaches the user only as the
 * cell's title and in the saved report — including `sessionExpiredShort`, which
 * was written short for a cell it never appears in.”
 *
 * ⚠️ **WHY THE FIX IS A SECOND FIELD AND NOT A CLEVERER CELL.** `errorMsg` is
 * written at four sites in `bulk-import-dialog.tsx` and carries two
 * populations. Three sites call `t(…)`. The fourth — the per-task catch —
 * writes all three kinds: `t(…)` for a page refusal, the Romanian of a
 * `TranslatedError` the run threw itself, and otherwise the caught string
 * (`HTTP 500`, `Failed to fetch`, `Import failed`). Showing the field
 * unconditionally puts English on a Romanian screen. What separates them is
 * whether the WRITER had a translator, which only the writer knows, so the
 * writer says so: `errorMsgTranslated`. Anything that reads the STRING to
 * guess — a word list, a diacritic, a length — is the version this suite exists
 * to keep out, and it cannot be caught by reading a diff.
 *
 * Four things have to hold and none of them holds by itself:
 *
 *   1. `errorCell` prints the sentence only when the flag is set;
 *   2. every site that writes `status: "error"` writes the flag with it, and
 *      the site that writes all three kinds writes the flag from the same two
 *      tests of provenance — the refusal token and `TranslatedError`;
 *   3. the cell is wired to `errorCell` rather than to `errorMsg`;
 *   4. the saved session and the saved HTML report print EXACTLY what they
 *      printed before this slice — the report is a permanent document.
 *
 * Two of those cross a file boundary with nothing but a string to join them,
 * which is why the source-reading guards are here. They are BEHAVIOUR guards —
 * comments are stripped before anything is matched — so a docblock saying the
 * right thing cannot make one pass.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { stripComments } from "@/lib/dev/strip-comments";
import { errorCell, TranslatedError } from "@/lib/import/error-cell";
import { scanIcu } from "@/test-support/icu";

const SRC = join(process.cwd(), "src");

/** A module's source with its comments removed — every guard here is a BEHAVIOUR guard. */
function codeOf(relPath: string): string {
  return stripComments(readFileSync(join(SRC, ...relPath.split("/")), "utf8"));
}

function messages(locale: "ro-RO" | "en-GB"): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

function block(locale: "ro-RO" | "en-GB", path: string): Record<string, string> {
  let node: unknown = messages(locale);
  for (const key of path.split(".")) {
    node = (node as Record<string, unknown>)[key];
  }
  return node as Record<string, string>;
}

const DIALOG = "app/admin/import/_components/bulk-import-dialog.tsx";
const LOCALES = ["ro-RO", "en-GB"] as const;

// ---------------------------------------------------------------------------
// 1. The decision itself
// ---------------------------------------------------------------------------

/** The already-translated „Eroare” the component hands in. */
const FALLBACK = "Eroare";

describe("errorCell", () => {
  /**
   * The row this slice was raised for: a session that died mid-run marks every
   * remaining file, and the two words written for it were reachable only by
   * hovering the cell.
   */
  it("prints the sentence a translator wrote", () => {
    expect(
      errorCell({ errorMsg: "Sesiune expirată", errorMsgTranslated: true }, FALLBACK),
    ).toEqual({ text: "Sesiune expirată", title: undefined });
  });

  it("prints a page refusal the same way", () => {
    expect(
      errorCell(
        { errorMsg: "Fișier peste limita de 50 MB", errorMsgTranslated: true },
        FALLBACK,
      ),
    ).toEqual({ text: "Fișier peste limita de 50 MB", title: undefined });
  });

  /**
   * ⚠️ **AND THE ROW THE SLICE DID NOT TOUCH KEEPS EVERY BYTE OF ITS OLD
   * BEHAVIOUR**: the constant on screen, the raw text on hover. „Eroare” is the
   * honest answer for an `HTTP 500` — it is not a placeholder awaiting removal,
   * and a row left with no status word at all would be worse than the cell this
   * slice narrows.
   */
  it.each(["HTTP 500", "Failed to fetch", "Import failed"])(
    "keeps „Eroare” and the hover for %s",
    (msg) => {
      expect(errorCell({ errorMsg: msg }, FALLBACK)).toEqual({
        text: FALLBACK,
        title: msg,
      });
    },
  );

  /**
   * ⚠️ **THE FLAG DECIDES, NOT THE STRING — SAID FROM BOTH SIDES.** A perfectly
   * Romanian message with no flag is still refused, because the next reader who
   * "improves" this into a test of the text has to see a case that says so; and
   * `false` is refused as flatly as absence, because `errorMsgTranslated` is
   * written only when true and a `false` arriving from anywhere means a writer
   * that did not decide.
   */
  it("refuses a Romanian-looking message that no writer vouched for", () => {
    expect(errorCell({ errorMsg: "Sesiune expirată" }, FALLBACK)).toEqual({
      text: FALLBACK,
      title: "Sesiune expirată",
    });
    expect(
      errorCell({ errorMsg: "Sesiune expirată", errorMsgTranslated: false }, FALLBACK),
    ).toEqual({ text: FALLBACK, title: "Sesiune expirată" });
  });

  /**
   * A flag over nothing decides nothing. The row still gets a status word —
   * which is the whole point of keeping „Eroare” — and the `title` stays
   * byte-for-byte what the old cell would have rendered for the same row
   * (`undefined` is omitted by React; `""` renders an empty attribute, exactly
   * as before).
   */
  it.each([undefined, "", "   "])("falls back when the message is %p", (msg) => {
    expect(errorCell({ errorMsg: msg, errorMsgTranslated: true }, FALLBACK)).toEqual({
      text: FALLBACK,
      title: msg,
    });
  });

  it("never invents a message when there is none at all", () => {
    expect(errorCell({}, FALLBACK)).toEqual({ text: FALLBACK, title: undefined });
  });
});

describe("TranslatedError", () => {
  it("is an Error, and carries its sentence unchanged", () => {
    const err = new TranslatedError("Selectați proveniența înainte de a continua.");
    expect(err instanceof Error).toBe(true);
    expect(err instanceof TranslatedError).toBe(true);
    expect(err.message).toBe("Selectați proveniența înainte de a continua.");
  });

  /**
   * ⚠️ **`name` STAYS `"Error"`, AND IT IS LOAD-BEARING.** The run-level catch
   * in `bulk-import-dialog.tsx` decides whether a message is ours to show with
   * `err instanceof Error && err.name === "Error"`. A subclass that set its own
   * `name` would make one of our own Romanian sentences fall through to
   * `importStartFailed` if it ever reached that catch — a sentence replaced by
   * a vaguer one, silently, which is the direction this slice runs against.
   */
  it("keeps the name the run-level catch tests for", () => {
    expect(new TranslatedError("x").name).toBe("Error");
  });

  it("is not claimed by anything else that travels the same catch", () => {
    expect(new Error("session-expired") instanceof TranslatedError).toBe(false);
    expect(new Error("HTTP 500") instanceof TranslatedError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Every writer says which kind it wrote
// ---------------------------------------------------------------------------

/**
 * The rest of the object literal an offset sits inside.
 *
 * Written as a brace walk rather than a fixed-size window because two of the
 * four sites are 330 characters apart, and a window wide enough for the widest
 * literal would let one site satisfy the guard for its neighbour — which is
 * precisely the failure (a site added without the flag) this is here to catch.
 */
function restOfLiteral(code: string, at: number): string {
  let depth = 1;
  for (let i = at; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") {
      depth--;
      if (depth === 0) return code.slice(at, i);
    }
  }
  throw new Error(`unterminated object literal at ${at}`);
}

describe("every site that fails a row says whether it had a translator", () => {
  const dialog = codeOf(DIALOG);

  it("finds the dialog to read", () => {
    expect(dialog).toContain("export type ImportResult = {");
    expect(dialog).toContain("errorMsgTranslated?: boolean;");
  });

  /**
   * Pinned at four, so a fifth way to fail a row is a deliberate edit to this
   * number rather than a silent „Eroare” on a row somebody wrote a sentence
   * for. The four as of this slice: the task skipped after an abort, the
   * per-task `session-expired`, the page refusal and its English fallback, and
   * the run-level catch that marks every row at once.
   *
   * ⚠️ **ONE KNOWN HOLE, PINNED HERE RATHER THAN LEFT TO BE DISCOVERED.** This
   * counts the literal in THIS file. A fifth site written through a helper in
   * another module — `failRow(entry, msg)` in `lib/import/` — carries its
   * `status: "error"` there and evades both this count and the per-site check.
   * A helper in this same file does not evade it. No source regex closes that,
   * and the day such a helper exists is the day this guard should move to it.
   *
   * ⚠️ **ALL THREE QUOTE SPELLINGS, AND TWO ADVERSARIAL ROUNDS ARE WHY.** The
   * first version searched for the double-quoted literal only; the second added
   * `'`. This repo has no ESLint `quotes` rule — `strip-comments.ts`'s own
   * header says so — so a fifth site written `status: 'error'`, and then one
   * written with a backtick, each slipped past the count in turn with the
   * paragraph above claiming it could not. The back-reference is what makes the
   * third spelling free rather than a fourth round.
   */
  const sites = [...dialog.matchAll(/status:\s*(["'`])error\1/g)].map((m) => m.index ?? 0);

  it("has exactly the four error-writing sites this slice knows about", () => {
    expect(sites).toHaveLength(4);
  });

  it.each(sites.map((at, i) => [i, at]))(
    "site %i writes a message and says which kind it is",
    (_i, at) => {
      const literal = restOfLiteral(dialog, at);
      expect(literal).toContain("errorMsg:");
      // ⚠️ **THE VALUE, NOT JUST THE KEY — AND A SECOND ADVERSARIAL ROUND IS
      // WHY.** Asserting only that `errorMsgTranslated:` appears is satisfied
      // by `errorMsgTranslated: looksRomanian`, with `looksRomanian` computed
      // from a diacritic one line above the literal. That mutation passed every
      // other assertion in this file, including the negative one below — which
      // only appeared to work, because `errorMsgTranslated` itself begins with
      // `errorMsg`, so it caught a same-line guess and nothing else. There are
      // exactly two legitimate values and they are both spelled out here.
      expect(literal).toMatch(/errorMsgTranslated:\s*(?:true|translated \? true : undefined),/);
    },
  );

  /**
   * ⚠️ **THE ONE SITE THAT WRITES BOTH KINDS, AND WHY THE TERNARY IS ASSERTED
   * RATHER THAN THE PRESENCE OF A FLAG.** `refusal` is exactly the question
   * "did this string come from `t`": the message is `t(refusal.messageKey, …)`
   * when it is truthy and the caught `msg` when it is not. A flag written from
   * any other test — a second condition, a default `true` — is how
   * `Failed to fetch` reaches a Romanian cell, and every assertion above would
   * still pass.
   */
  it("writes the flag from the same test that chose the message", () => {
    expect(dialog).toContain("errorMsg: refusal");
    expect(dialog).toContain("errorMsgTranslated: translated ? true : undefined");
  });

  /**
   * ⚠️ **AND BOTH HALVES OF `translated` ARE PINNED, BECAUSE A THIRD
   * ADVERSARIAL ROUND FOUND THE GUESS HAD JUST MOVED INTO THE DEFINITION.**
   * Pinning only the consumers left it free, and
   * `pageRefusalOfSentinel(msg) ?? (/[ăâîșț]/.test(msg) ? PAGE_REFUSALS[0] : null)`
   * passed every other assertion in this file: a diacritic deciding provenance,
   * one line above the ternary that reads it, with the flag still spelled
   * exactly as required. The caught string is called `msg` here, so the
   * `errorMsg`-shaped negative guards below cannot see it either. The callee is
   * named because the file holds two `const refusal =` lines — this one and
   * `uploadPage`'s, which reads a `code` rather than a sentinel.
   *
   * The second half is `err instanceof TranslatedError`: a test of the THROW,
   * for the sentences this file translates itself and then catches. Both are
   * questions about where the string came from; neither reads it.
   */
  it("takes both halves from a test of provenance, with nothing folded in", () => {
    expect(dialog).toContain("const refusal = pageRefusalOfSentinel(msg);");
    expect(dialog).toContain(
      "const translated = refusal !== null || err instanceof TranslatedError;",
    );
  });

  /**
   * ⚠️ **AND THE RUN'S OWN TRANSLATED THROWS GO OUT AS `TranslatedError`, WHICH
   * A FIFTH ADVERSARIAL ROUND ADDED.** Two `throw new Error(t(…))` inside the
   * per-task `try` — the corner-source conflict and the provenance guard —
   * arrived at the catch as plain messages, so the commonest coordinate-file
   * failure shipped „Eroare” with its Romanian on a hover: the very defect this
   * slice exists to remove, in the very slice that removes it. A plain `Error`
   * carrying a `t(…)` call is that mistake, so it is the thing asserted absent.
   */
  it("never throws a translated sentence as a plain Error", () => {
    // ⚠️ EVERY translator binding, not the two this slice happened to touch:
    // the dialog binds `t`, `tw`, `tprov` and `tres`, and a seventh adversarial
    // round added `throw new Error(tw(…))` inside the per-task try with the
    // suite still green.
    expect(dialog).not.toMatch(/throw new Error\(\s*t[A-Za-z]*\(/);
    expect(dialog).toContain("throw new TranslatedError(tprov(\"required\"))");
    expect(dialog).toMatch(/throw new TranslatedError\(\s*t\("cornerSourceConflict"/);
  });

  /**
   * ⚠️ **THE HALF THAT ROTS.** The flag is a claim about provenance; the moment
   * anything sets it by looking at the text, the claim is a guess. No call site
   * in the dialog may test `errorMsg` for anything but its presence.
   */
  it("never decides the flag by reading the message", () => {
    expect(dialog).not.toMatch(/errorMsgTranslated:\s*errorMsg/);
    expect(dialog).not.toMatch(/errorMsg[^\n]*\.(startsWith|includes|match|test)\(/);
  });

  /**
   * ⚠️ **AND THE REASON THE GUARD ABOVE IS NOT THE ONE THAT MATTERS.** It is
   * line-local: it catches a test of the string written ON the flag's own line
   * and nothing further away, because `errorMsgTranslated` starts with
   * `errorMsg` and so matches its own line by accident. The guess it cannot see
   * — a `const looksRomanian = …` one line up — is caught by the value pin in
   * the per-site case above, which admits exactly two spellings. Both are kept:
   * one names the shape, the other closes the hole.
   */
  it("admits exactly two spellings of the flag, across the whole file", () => {
    const values = [...dialog.matchAll(/errorMsgTranslated:\s*([^,\n]+)/g)].map((m) => m[1].trim());
    expect(values).toHaveLength(4);
    expect([...new Set(values)].sort()).toEqual(["translated ? true : undefined", "true"]);
  });
});

// ---------------------------------------------------------------------------
// 3. The cell reads the decision
// ---------------------------------------------------------------------------

describe("the results cell", () => {
  const dialog = codeOf(DIALOG);

  it("asks errorCell, with the translated fallback", () => {
    expect(dialog).toContain(`from "@/lib/import/error-cell"`);
    expect(dialog).toContain(
      `errorCell({ errorMsg, errorMsgTranslated }, t("errorShort"))`,
    );
  });

  it("renders that answer, both halves of it", () => {
    expect(dialog).toContain("title={failure.title}");
    expect(dialog).toContain("{failure.text}");
  });

  /**
   * The shape #34.20 shipped, asserted gone: a cell whose content was the
   * constant and whose only route to the message was the tooltip. If this ever
   * passes again, the sentence is back in a hover.
   */
  it("no longer hangs the raw message on the tooltip and nothing else", () => {
    expect(dialog).not.toContain("title={errorMsg}");
  });

  /**
   * ⚠️ **„Eroare” IS STILL IN THE BUILDING.** This slice narrows where it is
   * shown; deleting it would leave an `HTTP 500` row with no status word, which
   * is worse than the cell it replaced.
   */
  it("still has an errorShort to fall back to", () => {
    expect(dialog).toContain(`t("errorShort")`);
    for (const locale of LOCALES) {
      expect(block(locale, "adminImport.wizard.importDialog").errorShort.trim()).not.toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. The two readers that did NOT change
// ---------------------------------------------------------------------------

/**
 * ⚠️ **ONE OF THESE IS PERMANENT.** The saved HTML report is a document the
 * user keeps in File Explorer and cannot edit afterwards, and the saved session
 * is the only artefact of a run that survives a reload. #34.23 changed what the
 * CELL shows. Both of these print exactly what they printed before it, and that
 * is asserted here rather than intended in a commit message.
 */
describe("the saved session keeps errorMsg verbatim and learns nothing new", () => {
  const dialog = codeOf(DIALOG);
  const session = codeOf("lib/import/session.ts");

  it("still copies the message straight across", () => {
    expect(dialog).toMatch(/errorMsg:\s+r\.errorMsg,/);
  });

  /**
   * The flag is deliberately NOT carried, and the reason is SCOPE rather than
   * compatibility — `loadSavedSession` is a bare `JSON.parse(...) as`, so an
   * absent optional field is simply today's behaviour. The consequence is
   * recorded at the write site: a resumed row shows „Eroare” where the live row
   * showed its sentence. This assertion is what makes that a decision somebody
   * has to reverse on purpose rather than a field that drifts in.
   */
  it("does not carry the display flag", () => {
    expect(session).not.toContain("errorMsgTranslated");
  });
});

describe("the saved HTML report prints what it always printed", () => {
  const dialog = codeOf(DIALOG);

  it("builds the failure note from errorMsg, byte for byte", () => {
    expect(dialog).toContain(
      `tres("reportRowFailed", { reason: r.errorMsg ?? t("errorShort") })`,
    );
  });

  it("does not consult the display flag", () => {
    const at = dialog.indexOf(`tres("reportRowFailed"`);
    expect(at).toBeGreaterThan(0);
    expect(dialog.slice(at, at + 120)).not.toContain("errorMsgTranslated");
  });

  /**
   * The sentence itself, pinned in both locales. A reword here is a reword of
   * every report ever saved from this point on, so it should cost a failing
   * test.
   */
  it.each(LOCALES)("%s says it the way it has always said it", (locale) => {
    const expected = locale === "ro-RO" ? "nu a fost importat: {reason}" : "not imported: {reason}";
    expect(block(locale, "adminImport.result").reportRowFailed).toBe(expected);
  });

  it.each(LOCALES)("%s takes the reason and nothing else", (locale) => {
    const scan = scanIcu(block(locale, "adminImport.result").reportRowFailed);
    expect([...scan.args]).toEqual(["reason"]);
    expect(scan.plurals).toEqual([]);
  });

  /**
   * And the line itself, for the two rows this slice separates on screen. They
   * are separated on screen and IDENTICAL here — which is the whole claim, made
   * against the rendered string rather than against the diff.
   */
  it.each([
    ["ro-RO", "Sesiune expirată", "nu a fost importat: Sesiune expirată"],
    ["ro-RO", "HTTP 500", "nu a fost importat: HTTP 500"],
    ["en-GB", "Session expired", "not imported: Session expired"],
    ["en-GB", "HTTP 500", "not imported: HTTP 500"],
  ] as const)("%s renders %s as its own line", (locale, reason, expected) => {
    const line = block(locale, "adminImport.result").reportRowFailed.replace("{reason}", reason);
    expect(line).toBe(expected);
  });
});
