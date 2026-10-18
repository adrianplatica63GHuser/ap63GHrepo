/**
 * Slice #39.73 — the big map's „Selectează" picks properties for a group, and nothing on the map deletes.
 *
 * Adrian, 2026-10-17: „This is very destructive and should not be possible"; „a property should be deleted only from
 * the property form"; „we can start clicking properties one after another so they become selected when we are happy
 * with the list we can assign it to a group either an existing group or we send the user to create a new group under
 * administration Then use the back button to come to the list of selected properties and add them to the new group".
 *
 * The round trip itself is TC-MAP-07 (e2e/map/property-map-select-group.spec.ts). This suite holds what a source
 * read and a pure function can: the kept selection's shape, the additive update, and the guards that keep a delete
 * from coming back to the map or the Properties list.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { EMPTY_SELECTION, GROUPS_FROM_MAP_PATH, parseMapSelection } from "@/lib/groups/map-selection";
import { groupUpdateSchema } from "@/lib/groups/validation";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
/** Code alone: a behaviour guard reads no comment (the comments quote the old delete). */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const MAP = code(read("src", "app", "properties", "map", "property-map.tsx"));
const LIST = code(read("src", "app", "properties", "list-view.tsx"));
const GROUPS = code(read("src", "app", "admin", "groups", "_components", "groups-list-view.tsx"));
const QUERIES = code(read("src", "lib", "groups", "queries.ts"));
const ROUTE = code(read("src", "app", "api", "groups", "[id]", "route.ts"));

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("the kept selection (Ask first 3: per tab, until added or cancelled)", () => {
  it("reads back what was written", () => {
    const sel = { selecting: true, ids: [A, B], pickerOpen: true };
    expect(parseMapSelection(JSON.stringify(sel))).toEqual(sel);
  });

  it.each([
    [null],
    [""],
    ["not json"],
    ["[]"],
    ["42"],
    [JSON.stringify({ ids: [A] })],
    [JSON.stringify({ selecting: false, ids: [A], pickerOpen: true })],
  ])("anything unreadable, or not selecting, is the empty selection: %s", (raw) => {
    expect(parseMapSelection(raw)).toEqual(EMPTY_SELECTION);
  });

  it("keeps only string ids, once each, in the order clicked", () => {
    const raw = JSON.stringify({ selecting: true, ids: [B, 7, A, "", B, null], pickerOpen: "yes" });
    expect(parseMapSelection(raw)).toEqual({ selecting: true, ids: [B, A], pickerOpen: false });
  });

  it("„Grup nou…” goes to „Grupuri” with the add form open", () => {
    expect(GROUPS_FROM_MAP_PATH).toBe("/admin/groups?from=map");
    expect(MAP).toContain("router.push(GROUPS_FROM_MAP_PATH);");
    expect(MAP).toContain("writeMapSelection({ selecting: true, ids: [...selectedIds], pickerOpen: true });");
    expect(GROUPS).toContain("const [adding, setAdding] = useState(fromMap);");
    expect(GROUPS).toContain("rememberNewGroup(g.id);");
  });
});

describe("adding to a group adds, and leaves a member as it is", () => {
  it("the update takes `addMemberIds`, never together with `memberIds`", () => {
    expect(groupUpdateSchema.safeParse({ addMemberIds: [A, B] }).success).toBe(true);
    expect(groupUpdateSchema.safeParse({ addMemberIds: [] }).success).toBe(false);
    expect(groupUpdateSchema.safeParse({ addMemberIds: ["x"] }).success).toBe(false);
    expect(groupUpdateSchema.safeParse({ addMemberIds: [A], memberIds: [B] }).success).toBe(false);
    expect(groupUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("the wanted set is the current members plus the new ones, inside the update's transaction", () => {
    expect(QUERIES).toContain("const wanted = input.memberIds ?? [...new Set([...current, ...(input.addMemberIds ?? [])])];");
    expect(QUERIES).toContain("computeMemberDelta(current, wanted)");
  });

  it("the map sends its selection as `addMemberIds`", () => {
    expect(MAP).toContain("JSON.stringify({ addMemberIds: ids })");
    expect(MAP).toMatch(/method:\s*"PATCH"/);
  });
});

describe("Select is by clicks; nothing on the map deletes", () => {
  it("a click while selecting adds the property under it, or takes it out", () => {
    expect(MAP).toContain("togglePropertySelected(overlapping[overlapping.length - 1].id);");
    expect(MAP).toContain("togglePropertySelected(drop.items[0].id);");
  });

  it("dragging no longer selects (Ask first 2)", () => {
    expect(MAP).not.toContain("propertyInRect");
    expect(MAP).not.toContain("selectionRect");
    expect(MAP).toContain('gestureHandling="greedy"');
  });

  it("no delete route, no delete button", () => {
    expect(MAP).not.toContain("batch-delete");
    expect(MAP).not.toContain("Trash2");
  });

  it("without full access „Adaugă la grup…” is greyed, with the reason (Ask first 4)", () => {
    expect(MAP).toContain('note={canEditGroups ? undefined : t("map.addToGroupDenied")}');
    expect(MAP).toContain("disabled={!canEditGroups || selectedIds.size === 0}");
  });
});

describe("the Properties list deletes nothing either (Ask first 1)", () => {
  it("no batch delete, no tick boxes", () => {
    expect(LIST).not.toContain("batch-delete");
    expect(LIST).not.toContain("selectedIds");
    expect(LIST).not.toContain('type="checkbox"');
    expect(LIST).not.toContain("shared.bulkDelete");
  });
});

// 2026-10-18 — Adrian: „I would like to be told which one belongs to three groups already, so I can possibly go and
// remove it from one of the pre-existing groups"; and the refused add showed up as an error in the dev server.
describe("the three-groups cap names the properties over it", () => {
  it("the server finds every one, with its groups, and sends them as `overLimit`", () => {
    expect(QUERIES).toContain("membersOverLimit(");
    expect(QUERIES).toContain("throw new GroupError(`${rule}: ${named}`, 409, overLimit);");
    expect(ROUTE).toContain("{ error: err.message, overLimit: err.overLimit }");
  });

  it("the picker lists them, each group a link to its own screen, and can take them out of the selection", () => {
    expect(MAP).toContain('t("map.groupPicker.overLimit", { count: err.overLimit.length, max: MAX_GROUPS_PER_PROPERTY })');
    expect(MAP).toContain("href={`/admin/groups/${og.id}`}");
    expect(MAP).toContain('t("map.groupPicker.removeOverLimit", { count: overLimit.length })');
  });

  it("the refused add is not logged as an error — only a real failure is", () => {
    const catchBlock = MAP.slice(MAP.indexOf("if (err instanceof AddToGroupError && err.status === 409) {"));
    const capBranch = catchBlock.slice(0, catchBlock.indexOf("} else {"));
    expect(capBranch).not.toContain("console.error");
    expect(catchBlock.slice(0, catchBlock.indexOf('setAddError(t("map.groupPicker.failed"))'))).toContain("console.error");
  });
});
