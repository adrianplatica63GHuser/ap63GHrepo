/**
 * Slice 41.31 — Adrian: „if I click on “Show 1 empty field Notariat act părinte” the entire line … will just disappear
 * into thin air - and no empty field is shown".
 *
 * On an Act adițional with a parent deed linked, the four fallback fields sit under `<div hidden={linked}>`
 * (#38.34: hidden, never unmounted). The frame's empty-field paths named them, so „Arată 1 câmp gol" showed a field
 * whose parent stayed hidden, and the link went. While a deed is linked those paths are left out; unlinked, they come
 * back behind their own link. And no other field may hide under a hidden parent without the same treatment.
 */
import fs from "fs";
import path from "path";
import { offeredEmptyFieldPaths } from "@/lib/documents/template-groups";

const FORM = fs.readFileSync(path.join(process.cwd(), "src/app/documents/_components/document-form.tsx"), "utf8");
const AMENDED = [{ key: "actParinteNumar" }, { key: "actParinteData" }, { key: "actParinteNotariat" }, { key: "actParinteTip" }];
const FRAME = ["customFields.actParinteNumar", "customFields.actParinteData", "customFields.actParinteNotariat", "customFields.actParinteTip"];

describe("41.31 — the amended deed's fallback behind „Arată N câmpuri goale”", () => {
  it("a deed linked: none of the four is offered", () => {
    expect(offeredEmptyFieldPaths(FRAME, AMENDED, true)).toEqual([]);
    expect(offeredEmptyFieldPaths([...FRAME, "customFields.other"], AMENDED, true)).toEqual(["customFields.other"]);
  });

  it("no deed linked: every one is offered, so the link shows each empty field it names (Ask first 3)", () => {
    expect(offeredEmptyFieldPaths(FRAME, AMENDED, false)).toEqual(FRAME);
  });

  it("a type without the group: the paths as they are", () => {
    expect(offeredEmptyFieldPaths(FRAME, undefined, true)).toEqual(FRAME);
    expect(offeredEmptyFieldPaths(FRAME, [], true)).toEqual(FRAME);
  });

  it("the form passes every frame's paths through it, with the link's state", () => {
    expect(FORM).toContain("docTilePaths.set(tile, offeredEmptyFieldPaths(frameFieldPaths(tile), amendedGroup?.fields, !!parentDeed))");
  });

  // Ask first 2: the guard. A field under a hidden parent can never be shown by its tile's link; the one such parent in
  // the form is the amended deed's fallback, treated above. A second one fails here until it is treated the same way.
  it("the one hidden parent in the form is the amended deed's fallback", () => {
    const hiddenParents = FORM.match(/<div hidden=\{[^}]+\}[^>]*>/g) ?? [];
    expect(hiddenParents).toHaveLength(1);
    expect(hiddenParents[0]).toContain("data-amended-fallback");
  });
});
