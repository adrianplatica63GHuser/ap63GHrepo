/**
 * The Process panel's second 409, and the copy that tells it apart.
 *                                                    (Slice #26.07.fix)
 *
 * `/api/documents/[id]/process` now answers 409 for two different reasons, and
 * the difference is the whole of this slice's user-facing half:
 *
 *   conflict: "document" — this document already produced a Property. The
 *     user's intent is satisfied; the panel says so and links to it.
 *   conflict: "parcel"   — this document's tarla and parcela already belong to
 *     a Property that something ELSE built. Nothing was processed, nothing was
 *     written, and this document is the corner source of nothing.
 *
 * Before the discriminant existed the panel turned every 409 into "already
 * processed". Reporting the second as the first tells a user their document has
 * been dealt with when it has not — and the duplicate they were being protected
 * from goes unnoticed anyway, which is the whole reason the refusal exists.
 *
 * Nothing here renders React and nothing reaches a database. What can be
 * checked without either is that the copy exists in both locales, that Romanian
 * has the plural form it needs, and — by reading the two sources, the way the
 * import stage suites read theirs — that the branch is actually taken.
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

const PANEL = "src/app/documents/_components/process-panel.tsx";
const ROUTE = "src/app/api/documents/[id]/process/route.ts";

function loadCopy(file: string): Record<string, unknown> {
  const json = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as { document: { processPanel: Record<string, unknown> } };
  return json.document.processPanel;
}

/**
 * A file's source with every run of whitespace collapsed to one space.
 *
 * ⚠️ **Normalised, and an adversarial round is why.** The first version of this
 * suite grepped for `'conflict:     "document"'` with the five spaces the file
 * happens to align on — so re-indenting one line went RED while three
 * behaviour-destroying mutations stayed green. A guard that fails on formatting
 * and passes on deletion is worse than none: it spends the reader's trust
 * without buying anything.
 */
function source(relative: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relative), "utf8")
    .replace(/\s+/g, " ");
}

const NEW_KEYS = [
  "parcelTaken",
  "parcelTakenSeveral",
  "parcelTakenWhatToDo",
  "parcelTakenSeveralWhatToDo",
  // ⚠️ Five, not four. `openPropertiesList` is the label on the only escape
  // hatch the several-matches refusal offers, and it was the one key the
  // existence check skipped — deleting it from either locale left this suite
  // green and rendered the link as a raw key path.
  "openPropertiesList",
] as const;

describe("the parcel-conflict copy", () => {
  it.each(LOCALES)("%s carries every new key", (file) => {
    const copy = loadCopy(file);
    const missing = NEW_KEYS.filter(
      (key) => typeof copy[key] !== "string" || String(copy[key]).trim() === "",
    );
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)("%s interpolates exactly what the panel hands each sentence", (file) => {
    const copy = loadCopy(file);
    expect([...scanIcu(String(copy.parcelTaken)).args]).toEqual(["code"]);
    expect([...scanIcu(String(copy.parcelTakenSeveral)).args].sort()).toEqual(
      ["count", "parcela", "tarla"],
    );
    // ⚠️ Both advice strings, and the second one is why this line exists: it
    // was the one new key whose args nothing checked, and the panel calls it
    // with NO values. An `{code}` added to it renders as next-intl's
    // MISSING_FORMAT_VALUE — the key name — where the advice should be.
    expect([...scanIcu(String(copy.parcelTakenWhatToDo)).args]).toEqual([]);
    expect([...scanIcu(String(copy.parcelTakenSeveralWhatToDo)).args]).toEqual([]);
  });

  it.each(LOCALES)("%s pluralises the several-properties case, with Romanian's few", (file) => {
    const [block] = scanIcu(String(loadCopy(file).parcelTakenSeveral)).plurals;
    expect(block?.arg).toBe("count");
    const wanted = file === "ro-RO.json" ? ["one", "few", "other"] : ["one", "other"];
    expect(block.categories).toEqual(expect.arrayContaining(wanted));
  });

  it("⚠️ says NOTHING WAS DONE, which is the one fact that separates it from the other 409", () => {
    // A sentence that only named the existing property would read as a report
    // of success. What the user has to take away is that this document is still
    // unprocessed.
    expect(String(loadCopy("ro-RO.json").parcelTaken)).toContain("nu a fost procesat");
    expect(String(loadCopy("ro-RO.json").parcelTakenSeveral)).toContain("nu a fost procesat");
    expect(String(loadCopy("en-GB.json").parcelTaken)).toContain("was not processed");
    expect(String(loadCopy("en-GB.json").parcelTakenSeveral)).toContain("was not processed");
  });

  it("⚠️ tells the user what to DO, not only what went wrong", () => {
    // The refusal is a dead end without this: the document holds real
    // coordinates and the user has to be told the two ways out — attach it to
    // the property that exists, or fix the identifiers if it is a different
    // parcel.
    // …and it names something the user can actually reach. The identity comes
    // from the document's folder TAG, not from a field on the document form,
    // so "corectați tarlaua și parcela" pointed at an input that does not
    // exist on this screen.
    //
    // ⚠️ …in the app's OWN words. Romanian says "etichetă" everywhere —
    // `shared.entityMetadata.tags.title` is "Etichete / Cuvinte cheie",
    // `tags.remove` is "Elimină eticheta" — and nothing in the shipping UI is
    // ever labelled "tag". Advice that names a control by a word the product
    // does not use sends the user looking for something that is not there. It
    // also has to name the TAB: this panel is on Detalii and the tag editor is
    // on META INFO.
    expect(String(loadCopy("ro-RO.json").parcelTakenWhatToDo)).toContain("eticheta de dosar");
    expect(String(loadCopy("ro-RO.json").parcelTakenWhatToDo)).toContain("META INFO");
    expect(String(loadCopy("en-GB.json").parcelTakenWhatToDo)).toContain("folder tag");
    expect(String(loadCopy("en-GB.json").parcelTakenWhatToDo)).toContain("METADATA");
    // Several matches is a different job: the archive already holds a
    // duplicate, and attaching or re-tagging fixes nothing.
    expect(String(loadCopy("ro-RO.json").parcelTakenSeveralWhatToDo)).toContain("una singură");
    expect(String(loadCopy("en-GB.json").parcelTakenSeveralWhatToDo)).toContain("a single one");
  });

  it("⚠️ never tells the user to delete a property and try again — the retry fails", () => {
    // The first draft ended "…apoi reveniți și încercați din nou". Follow it and
    // the retry is refused again: reducing N matches to 1 still leaves ONE, and
    // `ensurePropertyForFolder` without a `confirm` answers `needs-confirmation`
    // for one match exactly as it does for three. So the only wording that
    // works is the one it already reaches — keep one, then ATTACH the document
    // to it. This was the single destructive instruction in the slice, and its
    // stated payoff did not exist.
    for (const file of LOCALES) {
      const advice = String(loadCopy(file).parcelTakenSeveralWhatToDo);
      for (const promise of ["încercați din nou", "try again", "reveniți"]) {
        expect({ file, promise, said: advice.includes(promise) })
          .toEqual({ file, promise, said: false });
      }
    }
    expect(String(loadCopy("ro-RO.json").parcelTakenSeveralWhatToDo)).toContain("adăugați-i acest document");
    expect(String(loadCopy("en-GB.json").parcelTakenSeveralWhatToDo)).toContain("add this document to it");
  });

  it("⚠️ warns before it asks for the one irreversible thing in the slice", () => {
    // "Keep a single one" means deleting a Property, and there is no merge:
    // whatever documents, persons and corner history hang off the row being
    // deleted go with it. `property.confirmDelete.body` already says the
    // action cannot be undone — advice that walks a user to that button owes
    // them the same warning BEFORE they get there, and a word about moving
    // the associations first. CLAUDE.md records the near-miss this is for.
    const ro = String(loadCopy("ro-RO.json").parcelTakenSeveralWhatToDo);
    const en = String(loadCopy("en-GB.json").parcelTakenSeveralWhatToDo);
    expect(ro).toContain("nu poate fi anulată");
    expect(ro).toContain("mutați asocierile");
    expect(en).toContain("cannot be undone");
    expect(en).toContain("move those links");
  });

  it("⚠️ names the tab for every control it sends the user to", () => {
    // "Deschideți proprietatea și adăugați-i acest document" is followable —
    // the control is `property.document.associate` — but the Romanian tab is
    // "Acte", not "Documente", and a user reading "document" on a page whose
    // tabs are Detalii / Asocieri / META INFO / Persoane / Acte has to guess.
    // The META INFO half of the same sentence already set the pattern.
    expect(String(loadCopy("ro-RO.json").parcelTakenWhatToDo)).toContain("din fila Acte");
    expect(String(loadCopy("ro-RO.json").parcelTakenSeveralWhatToDo)).toContain("din fila Acte");
    expect(String(loadCopy("en-GB.json").parcelTakenWhatToDo)).toContain("from the Documents tab");
    expect(String(loadCopy("en-GB.json").parcelTakenSeveralWhatToDo)).toContain("from the Documents tab");
  });

  it("⚠️ the whole panel says 'etichetă', which is what the app calls a tag", () => {
    // The new string said "eticheta de dosar" while `description` and
    // `resultNoTag` two lines above still said "tag de dosar" — one panel,
    // two names for one thing, and only one of them appears anywhere in the
    // META INFO section the user is being sent to.
    const ro = loadCopy("ro-RO.json");
    for (const key of ["description", "resultNoTag", "parcelTakenWhatToDo"]) {
      expect({ key, saysTag: String(ro[key]).includes("tag de dosar") })
        .toEqual({ key, saysTag: false });
    }
    expect(String(ro.description)).toContain("etichetă de dosar");
    expect(String(ro.resultNoTag)).toContain("etichetă de dosar");
  });

  it("does not reuse the already-processed wording, which would be false here", () => {
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      expect(String(copy.parcelTaken)).not.toBe(String(copy.alreadyProcessedLink));
      expect(String(copy.parcelTaken)).not.toBe(String(copy.alreadyProcessed));
    }
  });
});

describe("the branch that uses it", () => {
  it("⚠️ the route sends a discriminant on BOTH of its 409s, and a 409 status", () => {
    // Without one on the document conflict too, the panel's `else` would be
    // doing the right thing by accident: an unlabelled 409 has to keep meaning
    // "already processed" for older responses, and that is only safe while the
    // new case is the one that carries a label.
    const route = source(ROUTE);
    // The trailing comma matters: the header's prose names the discriminant
    // too, and counting that as a fourth emitter would make this assertion a
    // reader of comments.
    expect(route.split('conflict: "document",').length - 1).toBe(3);
    expect(route).toContain('conflict: "parcel"');

    // ⚠️ …and the STATUS. Turning the parcel branch's 409 into a 200 left the
    // whole suite green while the panel took `res.ok` and rendered
    // "Proprietate creată" for a document that created nothing.
    const parcelReturn = route.slice(route.indexOf('error: "Parcel already has a property"'));
    expect(parcelReturn.slice(0, 800)).toContain("{ status: 409 }");

    // ⚠️ …and the BODY, on the route's side. Everything below pins what the
    // panel does with these three fields and nothing pinned that they are
    // sent. `matchCount: 1` as a constant renders every multi-match refusal as
    // the singular one — "already belong to property PROP-42", "open it and
    // add this document" — pointing at an arbitrary one of the duplicates,
    // which is the harm the link test further down says it guards. Deleting
    // `tarla`/`parcela` renders "tarlaua — și parcela —".
    expect(parcelReturn).toContain("matchCount: outcome.matches.length,");
    expect(parcelReturn).toContain("tarla: tarlaSola, parcela,");

    // ⚠️ …on ALL THREE, not just the new one. Turning the mid-route `ownLink`
    // 409 into a 200 left the count above at 3 and the parcel slice's status
    // intact, so the suite stayed green while the panel took `res.ok` and
    // rendered "Proprietate creată" for a request that created nothing.
    let from = 0;
    for (let i = 0; i < 3; i++) {
      const at = route.indexOf('conflict: "document",', from);
      expect({ i, found: at >= 0 }).toEqual({ i, found: true });
      expect({ i, status409: route.slice(at, at + 400).includes("{ status: 409 }") })
        .toEqual({ i, status409: true });
      from = at + 1;
    }
  });

  it("⚠️ the route still asks whether the parcel is identified at all", () => {
    // `if (false && parcelIdentified)` turns the whole dedupe off and leaves
    // every string this suite greps for sitting in dead code.
    const route = source(ROUTE);
    expect(route).toContain("if (parcelIdentified) {");
    // …and the identity has to pass the SHAPE test, not merely be non-empty —
    // otherwise an archive tag locks a folder's other parcels out for good.
    expect(route).toContain("looksCadastral(tarlaSola as string)");
    expect(route).toContain("looksCadastral(parcela as string)");
    // ⚠️ …and the three are ANDed. Swapping `&&` for `||` leaves all three
    // substrings above intact and turns the gate inside out: `2019-2020 dosare`
    // satisfies `hasCadastralIdentity` on its own, so the archive tag is
    // treated as an identity again — the exact lockout this test claims to
    // guard. Whole expression, not a substring.
    expect(route).toContain(
      "const parcelIdentified = hasCadastralIdentity(tarlaSola, parcela) " +
      "&& looksCadastral(tarlaSola as string) && looksCadastral(parcela as string);",
    );
  });

  it("⚠️ step 5's tag ranking is NOT shape-aware, and that was a decision", () => {
    // A cadastral tie-break inside a rank tier was written and then taken out
    // again: shape correlates with "is a property folder", it does not decide
    // it. With the preference on, `2019-2020` (two bare numbers, cadastral)
    // beats `12-superficie teren` (a parcela made of words, not cadastral), so
    // a real property folder loses to its archive ancestor and
    // `findEntitiesByTag` associates the whole archive to it. An ambiguous tag
    // failing `looksCadastral` at step 6.5 and falling through to the
    // unconditional create is the smaller failure, and it is what shipped
    // before this slice.
    const route = source(ROUTE);
    // No trailing comma in the expectation: it exists only because the arrow
    // body is currently wrapped across three lines, and Prettier joining them
    // would drop it — a guard that goes red on a reformat is the thing this
    // file's `source()` docblock exists to prevent. The `||` ordering is what
    // matters, and a tie-break in either position still breaks the match.
    expect(route).toContain("b.rank - a.rank || b.tag.length - a.tag.length");
    expect(route).not.toContain("Number(b.cadastral)");
  });

  it("⚠️ the route REFUSES rather than adopting, so a claim still only follows a create", () => {
    // Three adversarial rounds went into an adopt path here and it was taken
    // out again. The reason is worth pinning, because the next reader will have
    // the same idea: adoption gives a Property a SECOND possible claimer, and
    // `property_corner_source` has no unique index on `property_id` — so two
    // documents can both claim one polygon, and an `INSERT … WHERE NOT EXISTS`
    // does not stop it (measured on Postgres 16: two sources on 1706 of 2000
    // properties under four concurrent clients). Adoption needs the migration
    // first. Until then this route creates or refuses, and nothing else.
    const route = source(ROUTE);
    // The original claim, unchanged — safe precisely because the only way to
    // reach it is having just created the row.
    expect(route).toContain("await claimCornerSource(documentId, propertyId, updatedBy)");
    // No `confirm` is ever sent, so `ensurePropertyForFolder` can only create
    // or report. (`adopt` appears in the prose above it, explaining why; the
    // code is what this asserts.)
    expect(route).not.toContain("confirm: {");
    expect(route).not.toContain("claimSoleCornerSource");
    // …and the compensating delete is the pre-slice one again: this run's own
    // row, unconditionally. Adoption is what made an unconditional delete
    // dangerous — it gave the id a chance to be a Property the archive already
    // had — so with adoption gone the original is correct, and it is pinned
    // here as PRESENT rather than removed.
    //
    // Slice #29.04 changed the MECHANISM, not the intent, and this assertion
    // moved with it: the delete used to be a bare `db.delete(dbProperty)`,
    // which removed the property row and left its `principal_object` behind —
    // the FK carries no ON DELETE clause — so the loser's PROP code stayed
    // taken for ever, along with the entity_tag and entity_metadata rows this
    // route hangs off that id. It now goes through `deleteProperties`, which
    // deletes both in one transaction. Pinned as the FUNCTION rather than as
    // a `db.delete`, because reverting to the bare delete is the regression.
    expect(route).toContain("await deleteProperties([propertyId])");
    expect(route).not.toContain(".delete(dbProperty)");
    // What makes that safe is that the id reaching the claim is always a row
    // THIS request created: both branches assign it straight from a create,
    // and the match branch returns instead of assigning. An edit that ever set
    // it from `outcome.matches` would turn the delete above into data loss.
    expect(route).toContain(
      "createdPropertyId = outcome.property.id; propertyId = outcome.property.id;",
    );
    expect(route).toContain(
      "createdPropertyId = created.property.id; propertyId = created.property.id;",
    );
    expect(route).not.toContain("propertyId = first");
    expect(route).not.toContain("propertyId = outcome.matches");
    // ⚠️ …and the OTHER compensating delete, in the catch block, keyed on
    // `createdPropertyId`. Nothing pinned it: deleting the whole block left
    // this suite green while every failure after a successful claim — an
    // association insert, a tag write — released the claim and left a
    // permanent orphan Property holding the parcel's identity, which under
    // this slice's refuse-only design then 409s that document for ever.
    expect(route).toContain(
      "if (createdPropertyId) { await deleteProperties([createdPropertyId])",
    );
    expect(route).toContain(
      "if (createdPropertyId && claimedCornerSource) { await releaseCornerSourceLink(documentId, createdPropertyId)",
    );
  });

  it("⚠️ the panel actually RENDERS the parcel-conflict sentences", () => {
    // Deleting the whole JSX block left the state set, nothing on screen, and
    // this suite green — the panel showed a title and a button and no
    // explanation at all. Every key the copy tests above pin has to be asked
    // for by the component that is supposed to show it.
    const panel = source(PANEL);
    for (const key of [
      "parcelTaken",
      "parcelTakenSeveral",
      "parcelTakenWhatToDo",
      "parcelTakenSeveralWhatToDo",
    ]) {
      expect({ key, asked: panel.includes(`t("${key}"`) }).toEqual({ key, asked: true });
    }
    // Anchored on the whole guard, not a substring: `isParcelTaken && false &&`
    // still contains "isParcelTaken &&" and renders nothing at all.
    expect(panel).toContain('{isParcelTaken && panelState.status === "parcelTaken" && (');
  });

  it("⚠️ the count is the server's, and it picks the sentence the right way round", () => {
    const panel = source(PANEL);
    // `matchCount: 2` as a constant left every assertion above green while
    // every single-match refusal rendered the plural sentence and the
    // "keep a single one" advice, and never showed the property code.
    expect(panel).toContain("matchCount: body.matchCount || 1,");
    expect(panel).toContain("tarla: body.tarla ?? null,");
    expect(panel).toContain("parcela: body.parcela ?? null,");
    // Inverting either ternary swaps the two sentences and the two pieces of
    // advice without touching a key name.
    // ⚠️ ONE predicate for the sentence, the advice and the link. They used to
    // be two — the sentence also fell back on a missing code, the other two did
    // not — so a single match with no code read the code-free sentence, then
    // "open the property", then rendered no link: the dead end that had just
    // been removed one element above.
    expect(panel).toContain(
      "const severalMatches = panelState.status === \"parcelTaken\" " +
      "&& (panelState.matchCount > 1 || !panelState.link);",
    );
    expect(panel).toContain(
      '{!severalMatches && panelState.link ? t("parcelTaken", { code: panelState.link.propertyCode })',
    );
    expect(panel).toContain(
      '{severalMatches ? t("parcelTakenSeveralWhatToDo") : t("parcelTakenWhatToDo")}',
    );
  });

  it("⚠️ the refusal always leaves the user somewhere to go, and it agrees with the advice", () => {
    // Deleting the link left the suite green and the user reading "Deschideți
    // proprietatea" with nothing to open — `viewProperty` is used by two other
    // states, so its mere presence in the file proves nothing.
    const panel = source(PANEL);
    // Several matches → the LIST, because the advice is "keep a single one"
    // and a link to matches[0] labelled as THE property is how the wrong one
    // gets deleted.
    expect(panel).toContain('{severalMatches ? ( <Link href="/properties"');
    expect(panel).toContain('{t("openPropertiesList")}');
    // One match → that property.
    expect(panel).toContain(
      ") : panelState.link ? ( <Link href={`/properties/${encodeURIComponent(panelState.link.propertyId)}`}",
    );
  });

  it("⚠️ the panel re-reads the corner source before it renders a parcel refusal", () => {
    // The route's own `ownLink` check cannot close this: a second request
    // blocked on the advisory lock wakes when the winner COMMITS, which is
    // before the winner claims the corner source — so the route can answer
    // `parcel` about a Property built from this document's own file. Removing
    // this GET is invisible to every other assertion here and turns a repeat
    // click into "nothing was created, go and fix your folder tag" about the
    // Property that click just made.
    const panel = source(PANEL);
    const branch = panel.slice(panel.indexOf('if (body.conflict === "parcel")'));
    const guard = branch.slice(0, branch.indexOf('status: "parcelTaken"'));
    expect(guard).toContain("const own = await ownCornerSource(documentId);");
    expect(guard).toContain('if (own) { setPanelState({ status: "done", link: own }); return; }');

    // ⚠️ …and the helper it calls, because the call site proves nothing on its
    // own. `return null;` in place of `return body.link ?? null;`, or the
    // wrong URL, deletes the guard while leaving every assertion above green.
    const helper = panel.slice(panel.indexOf("async function ownCornerSource("));
    expect(helper.slice(0, 600)).toContain(
      "fetch( `/api/documents/${encodeURIComponent(documentId)}/corner-source`, )",
    );
    expect(helper.slice(0, 600)).toContain("return body.link ?? null;");
  });

  it("⚠️ the panel routes a parcel conflict away from the done state", () => {
    // The assertion the copy above cannot make: that the sentences are reached.
    // Read the source, as the import stage suites do, because rendering React
    // here would prove the JSX compiles rather than that the branch is taken.
    const panel = source(PANEL);
    const branch = panel.slice(panel.indexOf('if (body.conflict === "parcel")'));
    const elseAt = branch.indexOf("} else {");
    expect(elseAt).toBeGreaterThan(0);

    // ⚠️ Measured from `setPanelState({ status: "parcelTaken"` back, not from
    // the top of the branch. The branch now opens with the corner-source
    // re-read, whose whole job is to land on `done` — so "the parcel branch
    // never says done" stopped being true the moment that guard was added, and
    // a test asserting it would have to be weakened rather than fixed. What
    // still has to hold is that once the re-read comes back EMPTY, the only
    // state reachable is `parcelTaken`.
    const takenAt = branch.indexOf('setPanelState({ status: "parcelTaken"');
    expect(takenAt).toBeGreaterThan(0);
    const afterGuard = branch.slice(
      branch.indexOf("if (own) {"),
      elseAt,
    );
    expect(afterGuard.slice(afterGuard.indexOf("}")).includes('status: "done"')).toBe(false);
    expect(branch.slice(0, elseAt)).toContain('status: "parcelTaken"');

    // …and the unlabelled/document case still lands on `done`.
    expect(branch.slice(elseAt)).toContain('status: "done"');
  });

  it("⚠️ the panel still offers the button after a parcel conflict", () => {
    // Nothing was written, so there is something left to do — fix the tag, or
    // the property, and press again. The button is hidden only for the two
    // states that really are finished.
    const panel = source(PANEL);
    expect(panel).toContain("{!isAlreadyDone && !isSuccess && (");
    expect(panel).not.toContain("!isParcelTaken && !isAlreadyDone");
  });
});
