/**
 * Slice 41.99 — Ștampile as Grupuri: „Cum lucrezi cu ștampilele" is the wizard (one for both kinds), „Ce este o
 * Ștampilă?" a red tile with „Am înțeles", once per sign-in and across the row, the list 75 % of its old units, calm.
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  GROUP_WIZARD_KEY,
  STAMP_STEPS_OF_41_44,
  STAMP_WIZARD,
  STAMP_WIZARD_KEY,
  STAMP_WIZARD_NOTE,
  STAMP_WIZARD_STEPS,
  WORKFLOW_WIZARDS,
  readWizardChoice,
} from "@/lib/ui/group-workflows";
import { ADMIN_STAMPS_LIST_UNITS, ADMIN_STAMPS_SCREEN, ADMIN_STAMPS_WIZARD_UNITS } from "@/lib/ui/screen-tiles";
import { tableUnits } from "@/lib/ui/field-widths";

type Tree = { [k: string]: string | Tree };
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const messages = (l: string) => JSON.parse(read("messages", `${l}.json`)) as Tree;
const at = (t: Tree, path: string) => path.split(".").reduce<string | Tree | undefined>((n, k) => (n && typeof n === "object" ? n[k] : undefined), t);

describe("the stamp's wizard (Ask first 1, 2)", () => {
  it("two headings — the stamp itself, the objects it is on — and no map", () => {
    expect(STAMP_WIZARD.map((h) => [h.heading, [...h.choices]])).toEqual([
      ["self", ["find", "create", "describe", "delete"]],
      ["records", ["apply"]],
    ]);
  });
  it("each choice's steps start by finding the stamp; applying carries the record's note", () => {
    expect(STAMP_WIZARD_STEPS).toEqual({
      find: ["find"], create: ["find", "create"], describe: ["find", "describe"], delete: ["find", "delete"], apply: ["find", "members"],
    });
    expect(STAMP_WIZARD_NOTE).toEqual({ apply: "record" });
    expect(STAMP_STEPS_OF_41_44).toEqual(["find", "create", "members", "delete"]);
  });
  it("each kind keeps its choice apart; a stored choice of the other kind is none", () => {
    expect(STAMP_WIZARD_KEY).not.toBe(GROUP_WIZARD_KEY);
    expect(readWizardChoice(WORKFLOW_WIZARDS.stamp, "apply")).toBe("apply");
    expect(readWizardChoice(WORKFLOW_WIZARDS.stamp, "map")).toBeNull();
    expect(readWizardChoice(WORKFLOW_WIZARDS.group, "apply")).toBeNull();
  });

  it.each(["ro-RO", "en-GB"])("%s: every heading, choice and new step has its words", (l) => {
    const m = messages(l);
    for (const h of STAMP_WIZARD) {
      expect(typeof at(m, `stamp.workflows.wizard.headings.${h.heading}`)).toBe("string");
      for (const c of h.choices) for (const part of ["label", "why"]) expect(typeof at(m, `stamp.workflows.wizard.choices.${c}.${part}`)).toBe("string");
    }
    for (const s of Object.values(STAMP_WIZARD_STEPS).flat()) {
      const path = STAMP_STEPS_OF_41_44.includes(s) ? `stamp.workflows.steps.${s}` : `stamp.workflows.wizard.steps.${s}`;
      expect([path, typeof at(m, `${path}.title`), typeof at(m, `${path}.body`)]).toEqual([path, "string", "string"]);
    }
    expect(at(m, "stamp.workflows.wizard.question")).toBe(at(m, "group.workflows.wizard.question"));
    expect(at(m, "stamp.infoPanel.understood")).toBe(at(m, "group.infoPanel.understood"));
  });

  it.each(["ro-RO", "en-GB"])("%s: since 41.97 the record's step says nothing is written until „Salvează” — for both kinds", (l) => {
    const m = messages(l);
    for (const k of ["group", "stamp"]) {
      const body = at(m, `${k}.workflows.steps.record.body`) as string;
      expect(body).toContain(l === "ro-RO" ? "„Salvează”" : "„Save”");
      expect(body).not.toMatch(/Gata|Done|pe loc|at once/);
    }
  });
});

describe("Ștampile's screen (Ask first 3, 4)", () => {
  it("the wizard 3 units; the list 75 % of its old units; the about tile its own, red, with „Am înțeles”, once per sign-in", () => {
    expect(tableUnits(["description", "count", "rowActions"])).toBe(6);
    expect(ADMIN_STAMPS_LIST_UNITS).toBe(Math.floor(0.75 * 6));
    expect(ADMIN_STAMPS_WIZARD_UNITS).toBe(3);
    expect(ADMIN_STAMPS_SCREEN.flowUnits).toBe(7);
    const view = read("src", "app", "admin", "stamps", "_components", "stamps-list-view.tsx");
    expect(view).toContain('useOncePerSignIn(ADMIN_STAMPS_REGISTRY.entity, "about", tiles.choice.reveal);');
    expect(view).toContain('<StampAboutTile onUnderstood={() => tiles.choice.toggle("about")} />');
    expect(view).toContain('<WorkflowsTile kind="stamp" units={ADMIN_STAMPS_WIZARD_UNITS}');
    expect(view).toContain("<tr key={s.id} className={`${QUIET_ROW} ");
    expect(view).toContain("${QUIET_ROW_BUTTONS}`} data-row-buttons={QUIET_ROW_MARK}");
    const about = read("src", "app", "admin", "stamps", "_components", "stamp-about-tile.tsx");
    expect(about).toMatch(/className="basis-full [^"]*text-admin-title"/);
    expect(about).toContain('label={t("understood")}');
    expect(read("src", "app", "admin", "stamps", "page.tsx")).toContain("<StampsListView />");
  });
});
