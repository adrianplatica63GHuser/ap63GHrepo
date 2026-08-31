/**
 * The identity-scan stop screen's own copy, in both locales.   (Slice #32.08)
 *
 * This screen is the visible half of the import's FIRST content-based refusal.
 * Every sentence on it is either a claim about what is in the archive, an
 * instruction to go and split a file, or the reason there is no way past — and
 * it is read exactly once, by somebody whose run has just stopped over a scan
 * holding two real people's identity cards.
 *
 * It matters more than chrome usually does for one reason this whole folder
 * shares: `DEFAULT_LOCALE` is `ro-RO`, so a missing key does not fall back to
 * English — it renders the raw key path into the shipping UI.
 *
 * The component is not rendered here. Nothing in this suite renders React, and
 * a test that did would prove the JSX compiles rather than that the copy
 * exists — which is the half that goes wrong silently. The tests below read the
 * component's own source instead, so the list cannot drift from it.
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

const COMPONENT = path.join(
  "src",
  "app",
  "admin",
  "import",
  "_components",
  "import-cards-blocked-stage.tsx",
);

const WIZARD = path.join(
  "src",
  "app",
  "admin",
  "import",
  "_components",
  "import-wizard.tsx",
);

function readSource(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

function loadAll(file: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as Record<string, unknown>;
}

function at(node: unknown, keyPath: string): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>(
      (n, part) =>
        n !== null && typeof n === "object" ? (n as Record<string, unknown>)[part] : undefined,
      node,
    );
}

function loadCopy(file: string): unknown {
  return at(loadAll(file), "adminImport.cardsBlocked");
}

/**
 * Every string the panel asks for, by the exact path it uses, plus the one the
 * WIZARD asks for.
 *
 * Written out rather than derived from the JSON, which would only prove the
 * file agrees with itself. This list is the demand; the file is the supply, and
 * the source-scrape test below proves the two agree.
 *
 * ⚠️ `title` is asked for TWICE — the panel draws it as its heading and the
 * wizard announces it through its own permanently-mounted live region, because
 * a `role="status"` that mounts together with its text is not reliably
 * announced. `announce` is the wizard's alone, and it is the one key on this
 * list the panel must NOT draw: it is a sentence about what to do next, and the
 * screen says that at length under "Ce urmează".
 */
const REQUIRED_KEYS = [
  "title",
  "announce",
  "folderLine",
  "intro",
  "listTitle",
  "row",
  "whatNextTitle",
  "whatNext",
  // ⚠️ The reason there is no "continue anyway" on this screen, written down
  // where a user looks for one. See the test that pins it drawn twice.
  "noWaiver",
  "nothingWritten",
  "leave",
  "leaveHint",
  // The take-away page, mirroring `adminImport.typesBlocked.save`. The same six
  // strings of that group are deliberately absent — `rulesTitle` (this stage
  // has no rules), `allClear`, `blocked` and `notCheckedYet` (this page's
  // violation list is non-empty by construction), `warningsTitle` (no warnings)
  // and `rulesOnlyName` (the panel is never mounted without a folder). The
  // exporter omits each block rather than printing an empty one, so writing
  // them here would ship Romanian no user could ever see.
  "save.button",
  "save.hint",
  "save.filePrefix",
  "save.documentTitle",
  "save.generatedAt",
  "save.folderLabel",
  "save.violationsTitle",
] as const;

/** The keys the PANEL itself asks for — everything but the wizard's own. */
const PANEL_KEYS = REQUIRED_KEYS.filter((k) => k !== "announce");

/** The two sentences that carry a number. */
const COUNTED_KEYS = ["intro", "row"] as const;

describe("the identity-scan stop screen's copy", () => {
  it.each(LOCALES)("%s carries every string the screen asks for", (file) => {
    const copy = loadCopy(file);
    const missing = REQUIRED_KEYS.filter((key) => {
      const value = at(copy, key);
      return typeof value !== "string" || value.trim().length === 0;
    });
    expect(missing).toEqual([]);
  });

  it("counts things with a plural, in both locales", () => {
    // Romanian needs `few` as well as `one` and `other` — the language has a
    // third form for 2-19 — and #26.02 already shipped this exact bug once.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      for (const key of COUNTED_KEYS) {
        const text = String(at(copy, key));
        expect({ key, hasCount: text.includes("{count") }).toEqual({ key, hasCount: true });
        const [block] = scanIcu(text).plurals;
        expect({ key, arg: block?.arg }).toEqual({ key, arg: "count" });
        const wanted = file === "ro-RO.json" ? ["one", "few", "other"] : ["one", "other"];
        expect(block.categories).toEqual(expect.arrayContaining(wanted));
      }
    }
  });

  it("⚠️ keeps every counted sentence whole, inside its plural block", () => {
    // Romanian cannot agree from outside the block — "Un fișier … arată"
    // against "# fișiere … arată" — so a sentence with its subject outside the
    // block is wrong in one form or the other, and only in one, which is how it
    // survives a manual pass.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      for (const key of COUNTED_KEYS) {
        const text = String(at(copy, key));
        const before = text.slice(0, text.indexOf("{"));
        const after = text.slice(text.lastIndexOf("}") + 1);
        expect({ file, key, before: before.trim(), after: after.trim() }).toEqual({
          file,
          key,
          before: "",
          after: "",
        });
      }
    }
  });

  it("⚠️ asks for nothing the screen does not ask for, and vice versa", () => {
    // `REQUIRED_KEYS` claims to be the demand, and it was hand transcribed — so
    // a panel that started calling `t("back")` would ship a dotted key path
    // into the shipping locale with every other test here green. This reads the
    // two sources.
    const panel = readSource(COMPONENT);
    const asked = new Set(
      [...panel.matchAll(/(?<![A-Za-z0-9_])t\(\s*"([^"]+)"/g)].map((m) => m[1]),
    );
    expect(asked.size).toBeGreaterThan(10);
    const undeclared = [...asked].filter((k) => !REQUIRED_KEYS.includes(k as never)).sort();
    expect(undeclared).toEqual([]);
    expect(PANEL_KEYS.filter((k) => !asked.has(k))).toEqual([]);

    // ⚠️ **AND `announce` REALLY IS THE WIZARD'S**, which is what makes its
    // absence from the panel legitimate rather than a key nobody draws. The
    // wizard reaches for this namespace under its own alias.
    const wizard = readSource(WIZARD);
    const announced = new Set(
      [...wizard.matchAll(/tCardsBlocked\(\s*"([^"]+)"/g)].map((m) => m[1]),
    );
    expect([...announced].sort()).toEqual(["announce", "title"]);
    // …and the panel must NOT also draw `announce`: on screen the same sentence
    // is said at length under "Ce urmează", and a duplicate would be the one
    // paragraph a sighted user reads twice.
    expect(asked.has("announce")).toBe(false);
  });

  it("⚠️ the remedy works for a file inside a PAGE FOLDER, which is the hard case", () => {
    // ⚠️ **THE SIXTH ADVERSARIAL ROUND FOUND THE FIFTH ROUND'S FIX TURNING A
    // CAUGHT VIOLATION INTO AN UNCAUGHT ONE.** A page folder's files are the
    // PAGES OF ONE DOCUMENT. So "split the page in two and renumber the folder"
    // leaves both cards inside one page group: the re-import sees one person on
    // page one, passes the gate, creates ONE Document holding two people's
    // cards, and the identity-card step — which reads page one only — creates
    // person A and never mentions person B. Clean run, blended archive, no
    // sentence anywhere. The instruction has to say to take the page OUT of the
    // page folder.
    //
    // Pinned on the meaning rather than the wording: the sentence must name the
    // page folder, must say to take the file out of it, and must not stop at
    // renumbering.
    for (const [file, folder, out] of [
      ["ro-RO.json", /folder de pagini/i, /scoateți pagina din folderul de pagini/i],
      ["en-GB.json", /page folder/i, /take the page out of the page folder/i],
    ] as const) {
      const next = String(at(loadCopy(file), "whatNext"));
      expect({ file, folder: folder.test(next) }).toEqual({ file, folder: true });
      expect({ file, out: out.test(next) }).toEqual({ file, out: true });
    }
  });

  it("⚠️ offers no way past the refusal — no continue, no retry", () => {
    // THE CONSTRAINT THE WHOLE SLICE HANGS ON, and the reason this is a screen
    // of its own rather than a second finding on `types-blocked`. That screen
    // carries "Continuă fără formulare" since #32.05, and it is right to: a
    // type without a form is a decision a business user may reasonably
    // overrule. This is not — waiving it creates one Person record blended out
    // of two real people, which is the harm the slice exists to prevent.
    //
    // Pinned on the SOURCE as well as on the copy, because a waiver arrives as
    // a prop and a handler long before anybody writes a label for it.
    const panel = readSource(COMPONENT);
    expect(panel).not.toContain("onContinue");
    expect(panel).not.toContain("continueWithoutForms");
    // No retry either, and that is a different absence: nothing here made a
    // request, so a second press would recompute the same verdict for ever.
    expect(panel).not.toContain("onRetry");
    // The only press is the one that leaves.
    expect(panel).toContain("onClick={onLeave}");
    const props = panel.slice(panel.indexOf("type Props = {"), panel.indexOf("};", panel.indexOf("type Props = {")));
    expect(props).toContain("onLeave: () => void;");
    expect(props.match(/\(\) => void/g)).toEqual(["() => void"]);
  });

  it("⚠️ says WHY there is no way past, on the screen and on the page", () => {
    // A user who met `types-blocked` last time reads a missing button as a
    // missing button. `noWaiver` is what stops that, and it has to be on the
    // take-away too: a reader holding the saved page in File Explorer would
    // otherwise conclude there was a Continue they had missed.
    const panel = readSource(COMPONENT);
    const inNote = panel.indexOf('lines: [t("whatNext"), t("noWaiver")]');
    const onScreen = panel.indexOf('{t("noWaiver")}');
    // An anchor that is not there is `-1`, and `-1` is smaller than
    // everything — prove both are present before comparing anything.
    expect(Math.min(inNote, onScreen)).toBeGreaterThan(0);
    // …and the sentence itself names the consequence rather than the rule. "The
    // software will not let you" teaches nobody anything; "a person with one
    // man's name and another's CNP" is the fact that makes the split worth
    // doing.
    expect(String(at(loadCopy("ro-RO.json"), "noWaiver"))).toContain("CNP");
    expect(String(at(loadCopy("en-GB.json"), "noWaiver"))).toContain("CNP");
  });

  it("⚠️ prices the RESTART, and only under the button that restarts", () => {
    // #32.05's argument on the sibling screen, applied here: the preparation
    // line is free, so "just start again" reads as costless — and it is not,
    // because #29.08 moved the billed classification in front of this screen.
    // `leaveHint` sits under "Oprește importul" and is that route's own
    // sentence; `nothingWritten` is a claim about the archive and must not
    // carry a price.
    for (const [file, paid, again] of [
      ["ro-RO.json", /plăt/i, /din nou/i],
      ["en-GB.json", /paid/i, /again/i],
    ] as const) {
      const hint = String(at(loadCopy(file), "leaveHint"));
      expect({ file, paid: paid.test(hint) }).toEqual({ file, paid: true });
      expect({ file, again: again.test(hint) }).toEqual({ file, again: true });
      const written = String(at(loadCopy(file), "nothingWritten"));
      expect({ file, prices: paid.test(written) }).toEqual({ file, prices: false });
    }
  });

  it("⚠️ lists the files rather than capping them", () => {
    // A folder can hold one two-card scan or twenty. The list is the evidence
    // for the sentence above it, and a list silently shortened is a list nobody
    // can check against File Explorer — which is the only reason the rows are
    // worth reading. Three spellings of a cap, because a mutation round on the
    // sibling panel wrote it two ways the first grep missed.
    const panel = readSource(COMPONENT);
    expect(panel).toContain("refused.map");
    const list = panel.slice(panel.indexOf("refused.map"), panel.indexOf("</ul>", panel.indexOf("refused.map")));
    expect(list).not.toContain(".slice(");
    expect(list).not.toContain(".filter(");
    expect(list).not.toMatch(/\bi\s*[<>]=?\s*\d/);
  });

  it("⚠️ builds the take-away with the shared exporter, not a second one", () => {
    const panel = readSource(COMPONENT);
    for (const symbol of [
      "buildRulesPageHtml",
      "reportFileName",
      "downloadHtmlFile",
      "fileNameStamp",
    ]) {
      expect(panel).toContain(symbol);
    }
  });

  it("says something different in Romanian than in English", () => {
    // Romanian is the shipping locale and English is the development
    // convenience; identical strings mean the Romanian was never written.
    const ro = loadCopy("ro-RO.json");
    const en = loadCopy("en-GB.json");
    expect(REQUIRED_KEYS.filter((key) => at(ro, key) === at(en, key))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The two LATER refusals, which are rows rather than screens
// ---------------------------------------------------------------------------

describe("the refusals behind the block", () => {
  /**
   * Both are backstops, and neither is a prevention: by the time they fire the
   * Document exists and its pages are uploaded. What they stop is two people's
   * details being written onto one record — which is why each has to have a
   * sentence of its own rather than falling through to a generic failure.
   */
  const LATER = [
    // The AI read of a document during the run.
    "adminImport.wizard.importDialog.aiMultiIdentity",
    // The identity-card step — the one refusal that must not be skippable, and
    // the only one of the three that stands between a scan and a `natural_person`
    // row.
    "adminImport.wizard.importDialog.idCard.error_multiple_identities",
  ] as const;

  it.each(LATER)("%s exists in both locales, and differs between them", (key) => {
    for (const file of LOCALES) {
      const value = at(loadAll(file), key);
      expect({ file, key, ok: typeof value === "string" && value.trim().length > 0 }).toEqual({
        file,
        key,
        ok: true,
      });
    }
    expect(at(loadAll("ro-RO.json"), key)).not.toEqual(at(loadAll("en-GB.json"), key));
  });

  it("⚠️ each says what to DO, because neither is a fault the user can retry away", () => {
    // The remedy is a job in File Explorer, and a sentence that only reported
    // the refusal would leave a business user pressing a retry that is refused
    // identically every time — the "press me again over an answer that cannot
    // change" failure this codebase has already recorded once.
    for (const key of LATER) {
      expect(String(at(loadAll("ro-RO.json"), key))).toMatch(/mpărț/i);
      expect(String(at(loadAll("en-GB.json"), key))).toMatch(/split/i);
    }
  });

  it("⚠️ the dialog really does choose its sentence from the CODE", () => {
    // `error_multiple_identities` is selected by `KNOWN_ERROR_CODES`. Left off
    // that list the dialog falls through to the route's `error` string, which
    // is the developer-facing English every refusal there carries — an English
    // sentence on a Romanian screen, with every copy test above still green.
    const dialog = readSource(
      path.join("src", "app", "admin", "import", "_components", "id-card-person-dialog.tsx"),
    );
    const list = dialog.slice(
      dialog.indexOf("const KNOWN_ERROR_CODES = ["),
      dialog.indexOf("] as const;", dialog.indexOf("const KNOWN_ERROR_CODES = [")),
    );
    expect(list).toContain("MULTI_IDENTITY_CODE");
  });

  it("⚠️ the count actually REACHES the gate — the defect that made it dead code", () => {
    // ⚠️ **THE WORST FINDING OF THE FIRST ADVERSARIAL ROUND, PINNED SO IT
    // CANNOT RECUR.** The first draft declared `identityPersonCount`, returned
    // it from the route and read it in the gate — and never stored it on the
    // row. It was OPTIONAL on `ScanResult` then, so that type-checked
    // perfectly: the gate answered "clean" on every folder and the whole stop
    // screen was unreachable in production. Nothing else in this suite could
    // see it: the gate's own tests exercise a pure module, and the copy tests
    // scrape text.
    //
    // Two assertions, because either alone can be satisfied by a broken wizard:
    // the value must be WRITTEN onto the scan result, and it must be READ back
    // out into the gate's input.
    const wizard = readSource(WIZARD);
    const built = wizard.slice(
      wizard.indexOf('const result: ScanResult = {'),
      wizard.indexOf("};", wizard.indexOf('const result: ScanResult = {')),
    );
    expect(built).toContain("identityPersonCount: cl.identityPersonCount");
    expect(wizard).toContain("function multiCardEntriesOf");
    const read = wizard.slice(
      wizard.indexOf("function multiCardEntriesOf"),
      wizard.indexOf("function entryScannable"),
    );
    expect(read).toContain("result.identityPersonCount");
    // ⚠️ **AND THE FINDING NAMES A FILE, NOT A FOLDER.** `FSPageGroupEntry.path`
    // is the SUBFOLDER, so keying the finding on it put a directory on a screen
    // that says "this scan has to be split", under an instruction to split "the
    // file" — with no indication which of the twenty numbered scans inside it.
    // `scanEntry` sends `handles[0]`, so that is the page the count is about.
    expect(read).toContain("entry.handles[0].name");
    // …and `scanEntry`'s return type declares it, so the value being READ is
    // type-checked at all: without it the shape comes off `res.json()` as
    // `any`, which is how the field went missing the first time.
    //
    // ⚠️ **WHAT MAKES OMITTING IT AN ERROR IS SOMETHING ELSE, and a second
    // adversarial round corrected this test's own claim that it was this.** An
    // optional property may simply be left out. `ScanResult.identityPersonCount`
    // is REQUIRED (`scan-table.tsx`), which is why the three sites that have no
    // answer set it to `null` — that is the guard, and this is the belt.
    const scanEntry = wizard.slice(
      wizard.indexOf("async function scanEntry"),
      wizard.indexOf("let file: File;", wizard.indexOf("async function scanEntry")),
    );
    expect(scanEntry).toContain("identityPersonCount: number | null;");
  });

  it("⚠️ takes the retry button off a REFUSED row, because a retry is billed", () => {
    // A refusal is deterministic: the same pages go to the same model and come
    // back with the same 422, at full price, every press. The row still counts
    // as unread — it genuinely was not read — but the OFFER is withdrawn, and
    // the row's sentence says what to do instead.
    const dialog = readSource(
      path.join("src", "app", "admin", "import", "_components", "bulk-import-dialog.tsx"),
    );
    // Whitespace-tolerant: the guard is what matters, and a Prettier reflow
    // must not fail a panel that is right.
    //
    // ⚠️ **BOTH FLAGS.** A re-read refusal means the same thing to a retry as a
    // read refusal does, and gating on `aiRefused` alone left a partially
    // written row whose RE-READ was refused drawing a live button directly
    // under a note saying the re-read had been refused.
    expect(dialog).toMatch(
      /canRetryInterpret\s*&&\s*!aiRefused\s*&&\s*!refillRefused\s*&&/,
    );
    // …and the two header counts partition the unread rows by the same pair,
    // through one expression, so they cannot disagree with the button.
    expect(dialog).toContain("const readRefused = (r: ImportResult): boolean =>");
    expect(dialog).toContain("r.aiRefused === true || r.refillRefused === true");
    // …set from the REASON at every site that writes a failed read — the run
    // loop and the retry — so a refusal arriving by either reaches the same row
    // state. The refill walk is the third site and sets the OTHER flag, because
    // it does not touch `aiStatus` and a document read perfectly by the run must
    // not be reported as never read.
    const setters = dialog.match(/aiRefused:\s*interpreted\.reason === "multi-identity"/g) ?? [];
    expect(setters.length).toBeGreaterThan(1);
    const refill = dialog.match(/refillRefused:\s*interpreted\.reason === "multi-identity"/g) ?? [];
    expect(refill.length).toBeGreaterThan(0);
    // Every place that writes a failed read must decide it — if a site writes
    // `aiStatus: "failed"` or `refill: "failed"` from a `runAiInterpret` result
    // and does not set the flag, the row keeps a retry that cannot help.
    // ⚠️ **BOTH COUNTS CARRY THE "IS UNREAD" TEST.** Without it on the refused
    // one, a document read perfectly by the run and refused on its RE-READ was
    // counted as never read: the header said so, the row drew nothing to match,
    // and the saved page said a third thing.
    expect(dialog).toMatch(
      /const unreadRetryableCount[\s\S]{0,200}aiStatus === "failed"[\s\S]{0,120}!readRefused\(r\)/,
    );
    expect(dialog).toMatch(
      /const unreadRefusedCount[\s\S]{0,900}aiStatus === "failed"[\s\S]{0,120}readRefused\(r\)/,
    );
    // …and the RE-READ's refusal is a different flag, on a different offer.
    expect(dialog).toContain("refillRefused: interpreted.reason === \"multi-identity\"");
    // …and the sentence says why there is no button, rather than leaving the
    // absence to be read as a missing control.
    for (const [file, needle] of [
      ["ro-RO.json", "Reîncearcă"],
      ["en-GB.json", "Try again"],
    ] as const) {
      expect(
        String(at(loadAll(file), "adminImport.wizard.importDialog.aiMultiIdentity")),
      ).toContain(needle);
    }
  });

  it("⚠️ the header never offers a retry no row has a button for", () => {
    // ⚠️ **THE MISMATCH THIS FILE'S OWN NEIGHBOUR RECORDS AS COSTING THREE
    // ADVERSARIAL ROUNDS, REOPENED FROM A FOURTH DIRECTION BY #32.08's FIRST
    // DRAFT.** `aiRefused` took the button off the row and left `unreadCount`
    // alone, so the header went on saying "try the read again here" over a
    // table with no such button anywhere. The sentence that offers a retry is
    // now counted from the retryable rows only, and the refused ones get a
    // sentence saying there is nothing to press.
    const dialog = readSource(
      path.join("src", "app", "admin", "import", "_components", "bulk-import-dialog.tsx"),
    );
    for (const key of ["doneUnread", "doneUnreadLocked", "doneUnreadWaiting"]) {
      expect(dialog).toContain(`t("${key}", { count: unreadRetryableCount })`);
    }
    expect(dialog).toContain('t("doneUnreadRefused", { count: unreadRefusedCount })');
    for (const file of LOCALES) {
      const refused = String(
        at(loadAll(file), "adminImport.wizard.importDialog.doneUnreadRefused"),
      );
      expect(refused).toContain("{count");
      const [block] = scanIcu(refused).plurals;
      const wanted = file === "ro-RO.json" ? ["one", "few", "other"] : ["one", "other"];
      expect(block.categories).toEqual(expect.arrayContaining(wanted));
    }
  });

  it("⚠️ the identity-card step's refusal is not an invitation to press again", () => {
    // ⚠️ **THE WORST FINDING OF THE SECOND ADVERSARIAL ROUND.** The
    // `extract-id-card` 422 landed on `personStepUnfinished`, whose note ends
    // "încercați din nou cu butonul «Confirmă persoanele»" — and every press of
    // that button is another billed model call that comes back refused
    // identically. On the ONE path this slice calls the refusal that must not
    // be skippable.
    const outcome = readSource(path.join("src", "lib", "import", "import-outcome.ts"));
    expect(outcome).toContain('"personCardRefused"');
    // Decided BEFORE `personStepUnfinished`: both flags can be set on one row,
    // and the two sentences point in opposite directions.
    const refusedAt = outcome.indexOf('id: "personCardRefused"');
    const unfinishedAt = outcome.indexOf('id: "personStepUnfinished"');
    expect(Math.min(refusedAt, unfinishedAt)).toBeGreaterThan(0);
    expect(refusedAt).toBeLessThan(unfinishedAt);
    // …the card comes out of the pending count, so the header stops offering
    // the control that re-opens the dialog…
    const dialog = readSource(
      path.join("src", "app", "admin", "import", "_components", "bulk-import-dialog.tsx"),
    );
    expect(dialog).toContain("r.personCardRefused !== true");
    // ⚠️ **…AND OUT OF THE QUEUE ITSELF, which is the half the first fix
    // missed.** The count only hides the header control when the refused card
    // is the ONLY thing outstanding; with anything else pending, "Confirmă
    // persoanele" rebuilds the queue from `idCardStepsRef` and re-opens the
    // refused card, which fires `extract-id-card` on mount and buys the same
    // 422 again. Deleting the step is what makes the refusal final.
    const failed = dialog.slice(
      dialog.indexOf("const handleIdCardFailed"),
      dialog.indexOf("}, [followUps, followUpIndex, updateResult]);", dialog.indexOf("const handleIdCardFailed")),
    );
    expect(failed).toContain("idCardStepsRef.current.delete(step.path)");
    expect(failed).toContain("personCardRefused: true");
    // …and the panel over that refusal is not headed "the reading failed",
    // which is the contradiction this slice removed one screen along.
    expect(
      readSource(
        path.join("src", "app", "admin", "import", "_components", "id-card-person-dialog.tsx"),
      ),
    ).toContain('refusedFatal ? t("extractRefusedTitle") : t("extractErrorTitle")');
    // …and the dialog is what says which kind of give-up it was, rather than
    // the caller guessing from a message.
    const card = readSource(
      path.join("src", "app", "admin", "import", "_components", "id-card-person-dialog.tsx"),
    );
    expect(card).toContain("onFailed?: (refused?: boolean) => void;");
    expect(card).toContain("const refused = data.code === MULTI_IDENTITY_CODE;");
    // Both the ref the callback reads and the state the heading renders from,
    // set from ONE expression so they cannot come to disagree.
    expect(card).toContain("refusedRef.current = refused;");
    expect(card).toContain("setRefusedFatal(refused);");
    // …and the note says split, not retry, in both locales.
    for (const [file, split, retry] of [
      ["ro-RO.json", /mpărț/i, /încercați din nou cu butonul/i],
      ["en-GB.json", /split/i, /try again with the/i],
    ] as const) {
      const note = String(
        at(loadAll(file), "adminImport.wizard.importDialog.note.personCardRefused"),
      );
      expect({ file, split: split.test(note) }).toEqual({ file, split: true });
      expect({ file, retry: retry.test(note) }).toEqual({ file, retry: false });
    }
  });

  it("⚠️ a refused read is VISIBLE and reaches the saved page, not just a tooltip", () => {
    // The remedy is a job in File Explorer, and it lived only on `title=` —
    // invisible on a touch screen and on paper. The row now draws the sentence
    // and the report writes it, by the same test, so the two artefacts cannot
    // disagree about what happened to a file.
    const dialog = readSource(
      path.join("src", "app", "admin", "import", "_components", "bulk-import-dialog.tsx"),
    );
    // On the row: drawn instead of `interpretFailed`, which says the fields
    // were left empty and never says why — and beside `interpretPartial` when
    // the read had already written some, so the screen does not drop a fact the
    // saved report keeps.
    expect(dialog).toMatch(/\{aiRefused\s*\n?\s*\?\s*aiPartialWrite/);
    expect(dialog).toMatch(/t\("aiMultiIdentity"\)\}? \$\{t\("interpretPartial"\)\}/);
    // …and in the saved report, ahead of the same `interpretFailed` it replaces.
    expect(dialog).toMatch(/r\.aiRefused === true\s*\?\s*\[t\("aiMultiIdentity"\)\]/);
  });

  it("⚠️ the AI read's sentence comes from the locale, not from the route", () => {
    // `runAiInterpret` returns `detail: null` for this reason on purpose, and
    // the dialog's own wrapper is what supplies the sentence. Written as an
    // ordinary `failed`, the row would print the route's English fallback.
    const run = readSource(path.join("src", "lib", "import", "ai-interpret-run.ts"));
    expect(run).toContain('reason: "multi-identity"');
    const dialog = readSource(
      path.join("src", "app", "admin", "import", "_components", "bulk-import-dialog.tsx"),
    );
    expect(dialog).toContain('result.reason === "multi-identity" ? t("aiMultiIdentity")');
    // …and every site that puts a failed read on a row goes through that
    // wrapper, rather than one of them keeping the module function.
    expect(dialog).not.toContain("failureDetail(interpreted)");
  });
});
