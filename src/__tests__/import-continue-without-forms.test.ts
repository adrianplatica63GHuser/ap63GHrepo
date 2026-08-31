/**
 * Continuing an import without forms, and the empty Document that is no longer
 * left behind.                                                 (Slice #32.05)
 *
 * TWO CHANGES, ONE SUITE, AND THEY ARE NOT RELATED BY SUBJECT
 * ----------------------------------------------------------
 * They are related by instrument. Both live in `import-wizard.tsx` and
 * `bulk-import-dialog.tsx` — the two largest files in the import path, neither
 * of which anything in `src/__tests__/` renders — so the guard available for
 * both is a source scan. The rules themselves are pinned properly elsewhere:
 * `shouldDiscoverType`'s waiver is a pure function with its own suite in
 * `import-discover-run.test.ts`, and the stop screen's copy and placement are
 * pinned in `import-types-blocked-copy.test.ts`. What is left over is the
 * WIRING, and wiring is exactly what a source scan can hold.
 *
 * ⚠️ **A SOURCE SCAN IS EVIDENCE, NOT PROOF, and every assertion below is
 * written to fail on the edit somebody would actually make** — a press
 * re-pointed at the run, a reset quietly dropped, a `false` passed at one of
 * two call sites, a delete removed as "defensive". None of them can prove the
 * component behaves; all of them cost a test to undo.
 */

import fs from "node:fs";
import path from "node:path";

const WIZARD = path.join(
  "src", "app", "admin", "import", "_components", "import-wizard.tsx",
);
const DIALOG = path.join(
  "src", "app", "admin", "import", "_components", "bulk-import-dialog.tsx",
);
const PANEL = path.join(
  "src", "app", "admin", "import", "_components", "import-types-blocked-stage.tsx",
);

function read(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

/** The same strip `import-run-stage.test.ts` records the reason for. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("the press that continues without forms", () => {
  it("⚠️ lands on the Evaluation screen, not on the Import stage and not on the run", () => {
    // The shortest reading of "click a button to continue" is a button that
    // starts the import. That button would skip the property step — which is
    // what attaches a document to anything at all — and the Import screen,
    // which is the one place the run's cost is stated before the click.
    // Continuing means "stop stopping", not "start writing".
    const handler = withoutComments(read(WIZARD));
    const start = handler.indexOf("const handleTypeGateContinue = useCallback(");
    expect(start).toBeGreaterThan(0);
    const body = handler.slice(start, handler.indexOf("}, [", start));
    expect(body).toContain('setPhase("folder-report")');
    expect(body).toContain("setTypeFormsWaived(true)");
    expect(body).not.toContain('setPhase("ready")');
    expect(body).not.toContain('setPhase("property")');
    expect(body).not.toContain('setPhase("importing")');
    // `setPhase`, not `settle`: this is a button the user pressed, and the table
    // in `workflow-stages.ts` never gates one.
    expect(body).not.toContain("settle(");
  });

  it("⚠️ leaves the phase machine alone", () => {
    // `phaseAfterClassification` answers what the SCAN decided, and the scan
    // still decides `types-blocked`; the waiver is a later answer to that
    // screen, not a different verdict from the classification. A new row in
    // `SELF_ADVANCING_TRANSITIONS` would be this slice rewriting a rule it only
    // needed to act after.
    //
    // ⚠️ **THIS TEST USED TO SAY "A THIRD INPUT THERE" AND #32.08 GAVE IT
    // ONE — LEGITIMATELY, WHICH IS WHY THE ASSERTION MOVED RATHER THAN THE
    // CODE.** That slice added `cardsClean`, a second VERDICT from the same
    // classification, and the order between the two stops is a fact about the
    // flow that only this module can hold. What #32.05 must not have done, and
    // still has not, is make the WAIVER an input to the fork: the shape below
    // is what pins that, and `typesClean` gaining `| null` is #32.08's — the
    // read is skipped entirely on a run the identity scans have stopped.
    const stages = read(path.join("src", "lib", "import", "workflow-stages.ts"));
    const fn = stages.slice(
      stages.indexOf("export function phaseAfterClassification"),
      stages.indexOf("// ---", stages.indexOf("export function phaseAfterClassification")),
    );
    expect(fn).toContain("typesClean: boolean | null;");
    // ⚠️ **COMMENT-STRIPPED SINCE #32.08, and the reason is worth writing
    // down.** The claim is that the waiver has not leaked into the phase
    // machine's CODE. That slice's argument for stopping at the identity scans
    // first is precisely that the other stop carries a waiver — so the prose
    // now says "waiver" while the code still does not mention it, and a raw
    // scan cannot tell those two apart. `withoutComments` is already the
    // instrument this same test uses on the table below.
    expect(withoutComments(fn)).not.toContain("waiv");
    const table = stages.slice(
      stages.indexOf("export const SELF_ADVANCING_TRANSITIONS"),
      stages.indexOf("];", stages.indexOf("export const SELF_ADVANCING_TRANSITIONS")),
    );
    expect(withoutComments(table)).not.toContain('from: "types-blocked"');
  });

  it("⚠️ forgets the waiver wherever the verdict is forgotten", () => {
    // A waiver is an answer about a verdict, so it is exactly as stale as the
    // verdict is. Both resets are the two `setTypeLookup(null)` sites: the new
    // walk inside `runWalk`, and the reset behind "Oprește importul".
    const wizard = withoutComments(read(WIZARD));
    const clears = [...wizard.matchAll(/setTypeLookup\(null\)/g)].map((m) => m.index ?? -1);
    expect(clears).toHaveLength(2);
    for (const at of clears) {
      // Within the same block of resets — the waiver line sits two lines below
      // the lookup line it belongs to, so a generous window still fails if a
      // reader adds a third reset site and forgets it.
      expect(wizard.slice(at, at + 400)).toContain("setTypeFormsWaived(false)");
    }
    // …and it is raised in exactly one place: the press.
    expect([...wizard.matchAll(/setTypeFormsWaived\(true\)/g)]).toHaveLength(1);
  });

  it("⚠️ is offered by the panel and decided by the wizard", () => {
    const wizard = read(WIZARD);
    expect(wizard).toContain("onContinueWithoutForms={handleTypeGateContinue}");
    expect(wizard).toContain("formsWaived={typeFormsWaived}");
    // The wizard's own guard: no waiver over a lookup that carries no verdict.
    // The panel draws the control only inside its verdict fragment; this is the
    // other half of the same invariant, asserted by the component that owns the
    // run's belief rather than the one that owns the screen.
    const start = withoutComments(wizard).indexOf(
      "const handleTypeGateContinue = useCallback(",
    );
    const body = withoutComments(wizard).slice(
      start,
      withoutComments(wizard).indexOf("}, [", start),
    );
    expect(body).toContain("typeLookup === null || !typeLookup.ok");
    expect(read(PANEL)).toContain("onContinueWithoutForms: () => void;");
  });
});

describe("what a waived run does and does not buy", () => {
  it("⚠️ passes the waiver at BOTH call sites of shouldDiscoverType", () => {
    // One of the two is the run loop and the other is the retry a user presses.
    // Passing `false` at the second would undo the waiver one row at a time:
    // the press means "read this DOCUMENT again", not "propose a form for its
    // type", and the first row anybody retried would open the very dialog the
    // waiver declined.
    const dialog = withoutComments(read(DIALOG));
    const calls = [...dialog.matchAll(/shouldDiscoverType\(\{[\s\S]*?\}\)/g)].map((m) => m[0]);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call).toContain("formsWaived,");
      // Never a literal at one site and the prop at the other.
      expect(call).not.toContain("formsWaived: false");
      expect(call).not.toContain("formsWaived: true");
    }
  });

  it("⚠️ does NOT hand the waiver to typeAwaitsForm", () => {
    // The split this slice is built on. `typeAwaitsForm` is what the ROW says,
    // and a waived type is still a type with no form — the archive now holds
    // documents on it, which is the honest thing to report. Silencing it would
    // make the result screen report a fully landed import over documents whose
    // values have nowhere to go, which is the exact overclaim
    // `type-form-gate.ts` exists to stop.
    const dialog = withoutComments(read(DIALOG));
    const calls = [...dialog.matchAll(/typeAwaitsForm\(\{[\s\S]*?\}\)/g)].map((m) => m[0]);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call).not.toContain("formsWaived");
  });

  it("⚠️ does not pre-seed the per-run claim with the waived types", () => {
    // `discoverClaimedRef` means "this run has already bought a read for this
    // type". A waived type has not, and a claim that says otherwise is a lie
    // that would survive into the retry handler — where the user pressing a
    // button IS asking for the read.
    const dialog = withoutComments(read(DIALOG));
    const adds = [...dialog.matchAll(/discoverClaimedRef\.current\.add\([^)]*\)/g)];
    expect(adds).toHaveLength(2);
    for (const add of adds) expect(add[0]).toContain("finalTypeId");
  });

  it("⚠️ has its own result-header sentence, ahead of the four written for a read that ran", () => {
    // On a waived run `discoverBacklog` is 0 by construction, so without a
    // branch of its own the header draws `doneTypesNoFormNothing` — "there are
    // no fields to review here" — which reports a read that found nothing over
    // a read nobody bought.
    const dialog = read(DIALOG);
    const start = dialog.indexOf("{formsWaived");
    expect(start).toBeGreaterThan(0);
    const chain = dialog.slice(start, dialog.indexOf("}", dialog.indexOf("doneTypesNoFormWaiting")));
    const waived = chain.indexOf("doneTypesNoFormWaived");
    const locked = chain.indexOf("doneTypesNoFormLocked");
    const nothing = chain.indexOf("doneTypesNoFormNothing");
    // ⚠️ **EACH ANCHOR IS PROVED PRESENT FIRST, and a second adversarial round
    // is why.** A missing needle is `-1`, and `-1` is smaller than everything —
    // so a typo in the code-side key alone (`doneTypesNoFormWaive`) left both
    // orderings satisfied, the locale test still found the JSON key, and ro-RO
    // rendered the raw key path on the one screen a business user reads. The
    // sibling assertion in `import-types-blocked-copy.test.ts` already guards
    // exactly this; this one did not.
    expect(Math.min(waived, locked, nothing)).toBeGreaterThanOrEqual(0);
    expect(waived).toBeLessThan(locked);
    expect(locked).toBeLessThan(nothing);
  });

  it("carries the waived sentences in both locales, with a Romanian few", () => {
    for (const file of ["ro-RO.json", "en-GB.json"] as const) {
      const messages = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
      ) as Record<string, never>;
      const at = (keyPath: string): unknown =>
        keyPath
          .split(".")
          .reduce<unknown>(
            (n, part) =>
              n !== null && typeof n === "object"
                ? (n as Record<string, unknown>)[part]
                : undefined,
            messages,
          );
      for (const key of [
        // ⚠️ The one string in the `continueWithoutForms` group the PANEL does
        // not draw: the wizard's live region announces it, because a
        // `role="status"` inserted together with its text is not announced and
        // this screen mounts on the transition. It is therefore invisible to
        // `import-types-blocked-copy.test.ts`'s panel scrape, and pinned here.
        "adminImport.typesBlocked.continueWithoutForms.announce",
        "adminImport.wizard.importDialog.doneTypesNoFormWaived",
        "adminImport.wizard.importDialog.pagesPartial",
        "adminImport.wizard.importDialog.emptyDocumentRemoved",
        "adminImport.wizard.importDialog.emptyDocumentLeft",
        "adminImport.wizard.importDialog.emptyDocumentOpen",
        "adminImport.wizard.importDialog.cornerClaimLost",
        "adminImport.wizard.forecast.waivedNote",
        "adminImport.importRun.waivedNote",
      ]) {
        const value = at(key);
        expect({ file, key, ok: typeof value === "string" && value.trim() !== "" }).toEqual({
          file,
          key,
          ok: true,
        });
      }
      // The two waiver notes count the same two things, and by name — a
      // positional argument would be the one mistake a translator cannot see.
      for (const key of [
        "adminImport.wizard.forecast.waivedNote",
        "adminImport.importRun.waivedNote",
      ]) {
        const text = String(at(key));
        expect({ file, key, types: text.includes("{types,") }).toEqual({
          file,
          key,
          types: true,
        });
        expect({ file, key, documents: text.includes("{documents,") }).toEqual({
          file,
          key,
          documents: true,
        });
      }
      // Romanian needs `few` as well as `one` and `other` — the language has a
      // third form for 2-19, and #26.02 already shipped that bug once.
      if (file === "ro-RO.json") {
        for (const key of [
          "adminImport.wizard.importDialog.doneTypesNoFormWaived",
          "adminImport.wizard.importDialog.pagesPartial",
          "adminImport.wizard.forecast.waivedNote",
          "adminImport.importRun.waivedNote",
        ]) {
          expect({ key, few: String(at(key)).includes("few {") }).toEqual({ key, few: true });
        }
      }
    }
  });
});

describe("the Document that is no longer left behind without a scan", () => {
  it("⚠️ deletes a Document whose first page never landed", () => {
    // Adrian's second UAT report: "Document Objects created but without scanned
    // image uploaded". Four things between the create and the upload can throw,
    // and the per-task catch marked the ROW an error and removed nothing — so
    // the archive kept a record nobody can ever see the scan of, and no screen
    // in the system says it is empty.
    const dialog = read(DIALOG);
    expect(dialog).toContain("async function discardEmptyDocument(");
    expect(dialog).toContain('method: "DELETE"');
    const body = withoutComments(dialog);
    // Awaited on both paths — a fire-and-forget delete on a dialog that is
    // closing is a request nothing keeps alive, and the orphan it was meant to
    // remove is exactly the orphan this closes.
    expect([...body.matchAll(/await discardEmptyDocument\(docId\)/g)]).toHaveLength(2);
    // …and only ever for a document with nothing on it. A delete reachable with
    // pages already uploaded would throw away real scans over a failure the
    // user can act on.
    for (const at of [...body.matchAll(/await discardEmptyDocument\(docId\)/g)].map(
      (m) => m.index ?? -1,
    )) {
      expect(body.slice(Math.max(0, at - 120), at)).toContain("pagesUploaded === 0");
    }
  });

  it("⚠️ records how many pages landed ON THE PATH THAT LOSES THEM", () => {
    // ⚠️ **THIS TEST'S FIRST DRAFT WENT GREEN OVER DEAD CODE, and an
    // adversarial round is why it now reads the `catch`.** The count was
    // written after the `try`, under `pagesUploaded < pagesExpected && mounted`
    // — and every route out of that block with a short count is either the
    // throw, which rethrew without writing anything, or the `!mounted` break,
    // which the `&& mounted` term excluded. The condition could not fire on any
    // input. Adrian's case — a page group whose fourth page failed, leaving a
    // Document holding three — arrives down the throw, so that is where the
    // assertion belongs.
    const body = withoutComments(read(DIALOG));
    const open = body.indexOf("} catch (err) {", body.indexOf("let pagesUploaded = 0;"));
    expect(open).toBeGreaterThan(0);
    const handler = body.slice(open, body.indexOf("throw err;", open));
    expect(handler).toContain("updateResult(entry.path, { pagesUploaded, pagesExpected, docId })");
    // …and only when some landed. A row that got nothing gets the delete and
    // its own sentence instead, so "0 of 5" is not a state a row can be in.
    expect(handler).toContain("pagesUploaded === 0");
    expect(handler).toContain("if (mounted) updateResult(entry.path, { pagesUploaded");
    // On the row AND in the saved report, from one key, so the two artefacts
    // cannot word it differently.
    expect([...body.matchAll(/t\("pagesPartial"/g)].length).toBe(2);
  });

  it("⚠️ says which of the two things happened to the empty Document", () => {
    // `discardEmptyDocument` reports its RESULT rather than only swallowing its
    // throws: `uploadPage` raises `session-expired` precisely because the POST
    // redirected to sign-in, and the DELETE one line later redirects too — so a
    // version that ignored the response reported success over a run that had
    // left an orphan behind on every file in the folder.
    const dialog = read(DIALOG);
    expect(dialog).toContain("): Promise<boolean> {");
    expect(dialog).toContain("return res.ok && !res.redirected;");
    const body = withoutComments(dialog);
    expect(body).toContain('emptyDocument: removed ? "removed" : "left"');
    // Both sentences reach the row and the saved report, from the same two keys.
    for (const key of ["emptyDocumentRemoved", "emptyDocumentLeft", "cornerClaimLost"]) {
      const drawn = [...body.matchAll(new RegExp(`t\\("${key}"\\)`, "g"))];
      expect({ key, sites: drawn.length }).toEqual({ key, sites: 2 });
    }
    // ⚠️ **AND THE LABEL FOLLOWS THE BRANCH.** A fifth round found this edit
    // standing with nothing behind it: reverting the label to a bare
    // `t("viewLink")` left every other assertion in this file green, over a
    // partial-page row telling the user to open "documentul rămas" — the
    // orphan's wording, on a row that is not an orphan. It cost a reading round
    // to find the first time.
    expect(body).toContain(
      'emptyDocument === "left" ? t("emptyDocumentOpen") : t("viewLink")',
    );
    // ⚠️ The corner sentence is drawn only where a claim really WAS MADE and
    // really did go with the delete. `cornerOwner !== undefined` — the first
    // draft's test — says only that this entry is a coordinate file: the claim
    // can still throw, on a conflict or a dead session, and the sentence would
    // then send the user to re-import a folder to restore a link that never
    // existed. The claim sets its own flag, after it lands.
    expect(body).toContain("cornerClaimed = true;");
    expect(body).toContain("cornerClaimed && removed");
    // …and the claim itself is INSIDE the block that tidies up. Left above it,
    // its three throws walked straight past the delete and left the archive
    // holding exactly the scanless Document this slice removes.
    const guarded = body.slice(
      body.indexOf("let pagesUploaded = 0;"),
      body.indexOf("} catch (err) {", body.indexOf("let pagesUploaded = 0;")),
    );
    expect(guarded).toContain("await claimCornerSource(docId, cornerOwner");
  });

  it("⚠️ does not tell the wizard a document was created before one exists", () => {
    // `onFirstDocumentCreated` feeds the Cancel confirmation's account of what
    // would be left behind, and `setRunCompleted`. Announced under
    // `createDocument`, a run whose only document is then discarded left it
    // true for ever: the Cancel dialog warned about an archive this run had
    // left exactly as it found it, and the Import button stayed suppressed as
    // "already run". It is announced after the pages instead.
    const body = withoutComments(read(DIALOG));
    const created = body.indexOf("const { id: docId, principalObjectId } = await createDocument(");
    const announced = body.indexOf("announceFirstDocument();");
    const uploaded = body.indexOf("let pagesUploaded = 0;");
    expect(Math.min(created, announced, uploaded)).toBeGreaterThan(0);
    expect(announced).toBeGreaterThan(created);

    // ⚠️ **AND IN THE OTHER DIRECTION, which the first draft of this test could
    // not fail.** Moving the announcement below the upload opened the mirror
    // hole: the two `catch` branches that KEEP a Document both re-throw, so
    // neither reached it, and a run that left an orphan in the archive told the
    // Cancel dialog it had left the archive untouched. It is called from every
    // place a Document survives — after the pages, on a refused delete, on a
    // partial page group, and on the unmount with pages already landed — and it
    // is idempotent by the flag it closes over.
    expect([...body.matchAll(/announceFirstDocument\(\);/g)]).toHaveLength(4);
    const open = body.indexOf("} catch (err) {", body.indexOf("let pagesUploaded = 0;"));
    const handler = body.slice(open, body.indexOf("throw err;", open));
    expect(handler).toContain("if (!removed) announceFirstDocument();");
    expect(handler).toContain("announceFirstDocument();");
    // …and exactly once per run, whichever of the four fired.
    expect(body).toContain("if (announcedFirstDocument) return;");
  });
});
