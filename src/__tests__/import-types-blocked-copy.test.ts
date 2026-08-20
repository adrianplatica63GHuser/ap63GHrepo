/**
 * The stop screen's own copy, in both locales.                 (Slice #29.08)
 *
 * This screen is the whole visible half of the slice: it is where an import
 * ends when a document type it found has no form to put a document's
 * information into. Every sentence on it is either a claim about money, a claim
 * about what is in the archive, or an instruction — and it is read exactly
 * once, by somebody whose run has just stopped.
 *
 * It matters more than chrome usually does for one reason this whole folder
 * shares: `DEFAULT_LOCALE` is `ro-RO`, so a missing key does not fall back to
 * English — it renders the raw key path into the shipping UI.
 *
 * The component itself is not rendered here. Nothing in this suite renders
 * React, and a test that did would prove the JSX compiles rather than that the
 * copy exists — which is the half that goes wrong silently. The last test reads
 * the component's source instead, so the list below cannot drift from it.
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
  "import-types-blocked-stage.tsx",
);

function loadCopy(file: string): Record<string, unknown> {
  const json = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as { adminImport: { typesBlocked: Record<string, unknown> } };
  return json.adminImport.typesBlocked;
}

function at(node: Record<string, unknown>, keyPath: string): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>(
      (n, part) =>
        n !== null && typeof n === "object" ? (n as Record<string, unknown>)[part] : undefined,
      node,
    );
}

/**
 * Every string the panel asks for, by the exact path it uses.
 *
 * Written out rather than derived from the JSON, which would only prove the
 * file agrees with itself. This list is the component's demand; the file is the
 * supply, and the last test reads the component to prove the two agree.
 *
 * ⚠️ `title` and `failed.title` are asked for by the WIZARD as well — it
 * announces the stop through its own permanently-mounted live region, because a
 * `role="status"` that mounts together with its text is not reliably announced.
 * They are listed once; the last test allows for the second reader.
 */
const REQUIRED_KEYS = [
  "title",
  "folderLine",
  "intro",
  "listTitle",
  "row.existing",
  "row.new",
  "unclassified",
  "whatNextTitle",
  "whatNext",
  "nothingWritten",
  "failed.title",
  "failed.unreadableIntro",
  "failed.unusableIntro",
  // ⚠️ A third cause with a third remedy, and the only one where the remedy is
  // cheap: signing in again and pressing the same button costs nothing, where
  // starting the import over pays for the whole classification twice.
  "failed.sessionIntro",
  "retry",
  "leave",
  "leaveHint",
  "chooseAnotherFolder",
  // Drawn from the second attempt onwards, so a retry that fails the same way
  // still changes the screen and the wizard's live region. See `typeGateAttempts`.
  "attempt",
] as const;

/** The four sentences that carry a number. */
const COUNTED_KEYS = ["intro", "row.existing", "row.new", "unclassified"] as const;

describe("the stop screen's copy", () => {
  it.each(LOCALES)("%s carries every string the panel asks for", (file) => {
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
    // Romanian cannot agree from outside the block — "Un tip … nu ARE" against
    // "# tipuri … nu AU" — so a sentence with its verb outside the block is
    // wrong in one form or the other, and only in one form, which is how it
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

  it("⚠️ says the classification was paid for, and that coming back pays again", () => {
    // The one sentence on this screen that is about money, and the reason it
    // exists: the preparation line is free, so "just start again" reads as
    // costless — and it is not, because #29.08 moved the billed classification
    // in front of this screen. A stop screen that let the user infer otherwise
    // would be the slice's own reorder, unstated.
    const ro = String(at(loadCopy("ro-RO.json"), "nothingWritten"));
    expect(ro).toMatch(/plăt/i);
    expect(ro).toMatch(/din nou/i);
    const en = String(at(loadCopy("en-GB.json"), "nothingWritten"));
    expect(en).toMatch(/paid/i);
    expect(en).toMatch(/again/i);
  });

  it("⚠️ does not offer a second attempt for the failure a second attempt cannot fix", () => {
    // `unusable` is a 200 carrying a list with no catch-all row: it will answer
    // the same way for ever. Its sentence must say what to put back rather than
    // suggest pressing the button again — and the button is not drawn on that
    // branch at all, which the component test below covers.
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      const unusable = String(at(copy, "failed.unusableIntro"));
      expect(unusable).toContain("UNCLASSIFIED");
      const unreadable = String(at(copy, "failed.unreadableIntro"));
      expect(unreadable).not.toContain("UNCLASSIFIED");
      const session = String(at(copy, "failed.sessionIntro"));
      expect(session).not.toContain("UNCLASSIFIED");
    }
  });

  it("⚠️ asks for nothing the panel does not ask for, and vice versa", () => {
    // `REQUIRED_KEYS` claims to be "the component's demand", and it was hand
    // transcribed — so a component that started calling `t("back")` would ship
    // a dotted key path into the shipping locale with every test here still
    // green. This reads the component's own source.
    const source = fs.readFileSync(path.join(process.cwd(), COMPONENT), "utf8");
    const asked = new Set(
      [...source.matchAll(/(?<![A-Za-z0-9_])t\(\s*"([^"]+)"/g)].map((m) => m[1]),
    );
    expect(asked.size).toBeGreaterThan(10);
    const undeclared = [...asked].filter((k) => !REQUIRED_KEYS.includes(k as never)).sort();
    expect(undeclared).toEqual([]);
    // `title` and `failed.title` are the two the wizard announces rather than
    // the panel drawing them alone, so they are allowed to be unused HERE —
    // except that the panel draws both as its heading, so in fact nothing is.
    const unused = REQUIRED_KEYS.filter((k) => !asked.has(k));
    expect(unused).toEqual([]);
  });

  it("⚠️ draws the retry only on the branch it can help", () => {
    // The behaviour the copy test above is the other half of. A button offered
    // for a deterministic failure is a button that says "press me again" over a
    // list that will never change its answer.
    const source = fs.readFileSync(path.join(process.cwd(), COMPONENT), "utf8");
    expect(source).toContain("verdict === null && !unusable");
    expect(source).toContain('reason === "unusable"');
    // …and the three causes really do reach three different sentences. Without
    // this the test above passes on a panel that computes `unusable` and then
    // draws one message for every failure.
    for (const key of ["unusableIntro", "sessionIntro", "unreadableIntro"]) {
      expect(source).toContain(`failed.${key}`);
    }
  });

  it("⚠️ has a sentence for every failure reason the gate can produce", () => {
    // ⚠️ **THE KEY LIST ABOVE IS DERIVED FROM THE PANEL, AND THE WIZARD ASKS
    // FOR ONE OF THESE TOO — with a COMPUTED key.** Its live region renders
    // `failed.${reason}Intro`, which no source scan can see, so a fourth
    // `TypeFormFailure` added to the union would ship a raw key path into the
    // shipping locale with every other test here green. This reads the union
    // itself and demands a sentence per member.
    const gate = fs.readFileSync(
      path.join(process.cwd(), "src", "lib", "import", "type-form-gate.ts"),
      "utf8",
    );
    const union = gate.slice(
      gate.indexOf("export type TypeFormFailure ="),
      gate.indexOf(";", gate.indexOf("export type TypeFormFailure =")),
    );
    const reasons = [...union.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
    expect(reasons.length).toBeGreaterThan(1);
    for (const file of LOCALES) {
      const copy = loadCopy(file);
      for (const reason of reasons) {
        const value = at(copy, `failed.${reason}Intro`);
        expect({ file, reason, ok: typeof value === "string" && value.length > 0 }).toEqual({
          file,
          reason,
          ok: true,
        });
      }
    }
    // …and no sentence for a reason the union does not have, which is the
    // mirror the #26.02 rule asks for: dead copy reads as live copy.
    const failed = at(loadCopy("ro-RO.json"), "failed") as Record<string, unknown>;
    const intros = Object.keys(failed).filter((k) => k.endsWith("Intro")).sort();
    expect(intros).toEqual(reasons.map((r) => `${r}Intro`).sort());
  });

  it("says something different in Romanian than in English", () => {
    // Romanian is the shipping locale and English is the development
    // convenience; identical strings mean the Romanian was never written.
    const ro = loadCopy("ro-RO.json");
    const en = loadCopy("en-GB.json");
    const same = REQUIRED_KEYS.filter((key) => at(ro, key) === at(en, key));
    expect(same).toEqual([]);
  });
});
