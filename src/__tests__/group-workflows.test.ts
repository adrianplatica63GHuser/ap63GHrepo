/**
 * Slice 41.84 — „Cum lucrezi cu grupurile" asks „Ce vrei să faci?" and shows only the chosen job's steps
 * (`@/lib/ui/group-workflows`); „Ce este un Grup?" closes with „Am înțeles".
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  GROUP_STEPS_OF_41_44,
  GROUP_WIZARD,
  GROUP_WIZARD_NOTE,
  GROUP_WIZARD_STEPS,
  readGroupWizardChoice,
} from "@/lib/ui/group-workflows";

type Tree = { [k: string]: string | Tree };
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const messages = (l: string) => JSON.parse(read("messages", `${l}.json`)) as Tree;
const at = (t: Tree, path: string) => path.split(".").reduce<string | Tree | undefined>((n, k) => (n && typeof n === "object" ? n[k] : undefined), t);

describe("the choices and their steps (Ask first 2)", () => {
  it("three headings: the group itself, its members, the map — six choices in all", () => {
    expect(GROUP_WIZARD.map((h) => [h.heading, h.choices])).toEqual([
      ["self", ["find", "create", "describe", "delete"]],
      ["members", ["members"]],
      ["map", ["map"]],
    ]);
  });

  it("each choice shows only its own steps; making, describing, deleting and the members start by finding the group", () => {
    expect(GROUP_WIZARD_STEPS).toEqual({
      find: ["find"],
      create: ["find", "create"],
      describe: ["find", "describe"],
      delete: ["find", "delete"],
      members: ["find", "members"],
      map: ["mapShow", "mapNew"],
    });
    expect(GROUP_WIZARD_NOTE).toEqual({ members: "record" });
  });

  it("a stored choice is read back; anything else is no choice (Ask first 3)", () => {
    expect(readGroupWizardChoice("map")).toBe("map");
    for (const raw of [null, undefined, "", "record", "__proto__"]) expect(readGroupWizardChoice(raw)).toBeNull();
  });
});

describe.each(["ro-RO", "en-GB"])("its words in %s", (locale) => {
  const m = messages(locale);
  it("the question, the three headings, each choice's label and why, each step's title and body, the note's title", () => {
    for (const path of ["group.workflows.wizard.question", "group.workflows.wizard.noteTitle", "group.infoPanel.understood"]) {
      expect([path, typeof at(m, path)]).toEqual([path, "string"]);
    }
    for (const h of GROUP_WIZARD) {
      expect(typeof at(m, `group.workflows.wizard.headings.${h.heading}`)).toBe("string");
      for (const c of h.choices) {
        for (const part of ["label", "why"]) expect([c, part, typeof at(m, `group.workflows.wizard.choices.${c}.${part}`)]).toEqual([c, part, "string"]);
        for (const s of GROUP_WIZARD_STEPS[c]) {
          const base = GROUP_STEPS_OF_41_44.includes(s) ? `group.workflows.steps.${s}` : `group.workflows.wizard.steps.${s}`;
          for (const part of ["title", "body"]) expect([s, part, typeof at(m, `${base}.${part}`)]).toEqual([s, part, "string"]);
        }
      }
    }
  });
  it("„Am înțeles” and the question in Adrian's words", () => {
    if (locale === "ro-RO") {
      expect(at(m, "group.infoPanel.understood")).toBe("Am înțeles");
      expect(at(m, "group.workflows.wizard.question")).toBe("Ce vrei să faci?");
    }
  });
  it("the members' note names a record's „Etichete și grupuri”, the map's steps the map's groups button", () => {
    const note = at(m, "group.workflows.steps.record.title") as string;
    expect(note).toContain(locale === "ro-RO" ? "„Etichete și grupuri”" : "„Tags and groups”");
    expect(at(m, "group.workflows.wizard.steps.mapShow.body")).toContain(locale === "ro-RO" ? "„Grupuri”" : "„Groups”");
  });
});

describe("the wiring", () => {
  it("the group's workflows tile is the wizard; „Ștampile” keeps its list (Ask first 5)", () => {
    const src = read("src", "components", "screen", "workflows-tile.tsx");
    expect(src).toContain('if (kind === "group") return <GroupWorkflowsWizard units={WORKFLOWS_UNITS} hidden={hidden} />;');
    expect(src).toContain("WORKFLOW_STEPS.map((key)");
  });
  it("„Ce este un Grup?” unticks itself in „Panouri” with „Am înțeles” (Ask first 1)", () => {
    expect(read("src", "app", "admin", "groups", "_components", "groups-list-view.tsx")).toContain('<GroupAboutTile onUnderstood={() => tiles.choice.toggle("about")} />');
    expect(read("src", "app", "admin", "groups", "_components", "group-about-tile.tsx")).toContain('label={t("understood")}');
  });
  it("all the text of both tiles is the Administrare red (Ask first 4)", () => {
    expect(read("src", "components", "screen", "group-workflows-wizard.tsx")).toContain("text-sm text-admin-title");
    expect(read("src", "app", "admin", "groups", "_components", "group-about-tile.tsx")).toContain("text-admin-title");
  });
});
