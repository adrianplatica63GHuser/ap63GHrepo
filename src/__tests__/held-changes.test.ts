/**
 * @jest-environment node
 *
 * Slice 41.97 — „Etichete și grupuri" and „Alte referințe" hold every add and remove until „Salvează" (held-changes.ts).
 * The order of the writes, „Renunță", the cap, and an add taken back.
 */
import {
  NOTHING_HELD, dropHeldRef, heldGroupCount, heldList, heldTags, heldWrites, holdGroupAdd, holdGroupRemove, holdRefAdd,
  holdRefRemove, holdStampAdd, holdStampRemove, holdTagAdd, holdTagRemove, isHeld, kindOfCode, sendHeld, type Held,
} from "@/lib/metadata/held-changes";

const G1 = { id: "g1", code: "GRP-001", description: "Unu" };
const G2 = { id: "g2", code: "GRP-002", description: "Doi" };
const S1 = { id: "s1", code: "STMP-AAA", shortDescription: "Urgent" };

describe("held until „Salvează” (Slice 41.97)", () => {
  it("nothing held: „Salvează” disabled, nothing to write", () => {
    expect(isHeld(NOTHING_HELD)).toBe(false);
    expect(heldWrites("po", NOTHING_HELD)).toEqual([]);
  });

  it("a tag typed twice is one, lower case; one the record has is not added; adding back a removed one cancels both", () => {
    let h = holdTagAdd(NOTHING_HELD, "  Arendă ", ["moștenire"]);
    h = holdTagAdd(h, "arendă", ["moștenire"]);
    expect(h.tags.add).toEqual(["arendă"]);
    expect(holdTagAdd(h, "MOȘTENIRE", ["moștenire"])).toBe(h);
    h = holdTagRemove(h, "moștenire");
    expect(heldTags(["moștenire"], h)).toEqual([{ tag: "arendă", added: true }]);
    h = holdTagAdd(h, "moștenire", ["moștenire"]);
    expect(h.tags.remove).toEqual([]);
    h = holdTagRemove(h, "arendă");
    expect(isHeld(h)).toBe(false);
  });

  it("groups and stamps: add, remove, and the two that cancel", () => {
    let h = holdGroupAdd(NOTHING_HELD, G2, ["g1"]);
    expect(holdGroupAdd(h, G1, ["g1"])).toBe(h); // already a member
    h = holdGroupRemove(h, "g1");
    expect(heldList([G1], h.groups).map((g) => [g.id, g.added])).toEqual([["g2", true]]);
    h = holdGroupAdd(h, G1, ["g1"]); // added back: the remove is gone
    expect(h.groups.remove).toEqual([]);
    h = holdGroupRemove(h, "g2"); // taken back: the add is gone
    expect(isHeld(h)).toBe(false);
    let s = holdStampRemove(NOTHING_HELD, "s1");
    s = holdStampAdd(s, S1, ["s1"]);
    expect(isHeld(s)).toBe(false);
  });

  it("the cap counts what will stand after the save", () => {
    let h: Held = holdGroupRemove(NOTHING_HELD, "g1");
    expect(heldGroupCount(["g1", "g2", "g3"], h)).toBe(2);
    h = holdGroupAdd(h, { id: "g4", code: "GRP-004", description: null }, ["g1", "g2", "g3"]);
    expect(heldGroupCount(["g1", "g2", "g3"], h)).toBe(3);
  });

  it("a reference by its code, upper case; one already there or held is not added; its kind read off the code", () => {
    let h = holdRefAdd(NOTHING_HELD, " pprop00001 ", "", []);
    expect(h.refs.add).toEqual([{ code: "PPROP00001", note: "" }]);
    expect(holdRefAdd(h, "PPROP00001", "x", [])).toBe(h);
    expect(holdRefAdd(NOTHING_HELD, "PPERS1", "", ["PPERS1"])).toBe(NOTHING_HELD);
    h = dropHeldRef(h, "PPROP00001");
    expect(isHeld(h)).toBe(false);
    expect(["PPERS00001", "JPERS00001", "PROP00001", "DOC00001"].map(kindOfCode)).toEqual(["natural", "judicial", "property", "document"]);
  });

  it("„Salvează” writes every remove first, then every add, one at a time, through today's routes", () => {
    let h = holdTagAdd(NOTHING_HELD, "nou", []);
    h = holdGroupAdd(h, G2, []);
    h = holdStampRemove(h, "s1");
    h = holdTagRemove(h, "vechi");
    h = holdRefAdd(h, "PROP00001", "de ce", []);
    h = holdRefRemove(h, "x1");
    h = holdGroupRemove(h, "g1");
    expect(heldWrites("po-1", h).map((w) => [w.method, w.url, w.body])).toEqual([
      ["DELETE", "/api/metadata/po-1/tags", { tag: "vechi" }],
      ["DELETE", "/api/metadata/po-1/groups/g1", undefined],
      ["DELETE", "/api/metadata/po-1/stamps/s1", undefined],
      ["DELETE", "/api/metadata/po-1/cross-refs/x1", undefined],
      ["POST", "/api/metadata/po-1/tags", { tag: "nou" }],
      ["POST", "/api/metadata/po-1/groups", { groupId: "g2" }],
      ["POST", "/api/metadata/po-1/cross-refs", { targetCode: "PROP00001", note: "de ce" }],
    ]);
  });

  it("a write that fails stops there: what went through is no longer held, the rest still is, and the error is said", async () => {
    let h = holdTagRemove(NOTHING_HELD, "vechi");
    h = holdTagAdd(h, "unu", []);
    h = holdTagAdd(h, "doi", []);
    const sent: string[] = [];
    const out = await sendHeld("po", h, async (w) => {
      sent.push(`${w.method} ${String(w.body?.tag)}`);
      return w.body?.tag === "unu" ? { ok: false, error: "too long" } : { ok: true };
    });
    expect(sent).toEqual(["DELETE vechi", "POST unu"]);
    expect(out.error).toBe("too long");
    expect(out.left.tags).toEqual({ add: ["unu", "doi"], remove: [] });
    const all = await sendHeld("po", out.left, async () => ({ ok: true }));
    expect(all).toEqual({ left: NOTHING_HELD, error: null });
  });
});
