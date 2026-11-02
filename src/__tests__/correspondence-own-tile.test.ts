/**
 * Slice 41.34 — Adrian: „For natural persons, tile Correspondence Address is missing Edit Save and Cancel buttons; It
 * should have those - as it is a piece of content different from the home address; the same is true for the
 * correspondence address of a juridical person".
 *
 * On both persons the home address (the registered office) and the correspondence address are two edit tiles: each its
 * own „Editează", „Salvează" and „Renunță"; the correspondence's save carries the „aceeași cu…" box, which is its
 * footer while it is open; its one-line „Adaugă" opens the correspondence tile, never the home one. The tile menu
 * keeps one „Adrese" (both panels); an ANAF fill still saves the registered office with the identity.
 */
import { readFileSync } from "fs";
import { join } from "path";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const NP = read("src", "app", "natural-persons", "_components", "natural-person-form.tsx");
const JP = read("src", "app", "judicial-persons", "_components", "judicial-person-form.tsx");

describe.each([
  ["natural person", NP, "home", "correspondenceSameAsHome", "addresses.HOME", "sameAsHomeBox"],
  ["juridical person", JP, "headquarters", "correspondenceSameAsHq", "addresses.HEADQUARTERS", "sameAsHqBox"],
] as const)("41.34 — the %s's two address tiles", (_who, src, first, box, firstPrefix, boxConst) => {
  it("two edit tiles, each with its own panel", () => {
    expect(src).toMatch(new RegExp(`${first}: \\["addresses"\\],\\s*correspondence: \\["addresses", "${box}"\\]`));
    expect(src).toContain(`  ${first}: "${firstPrefix}",\n  correspondence: "addresses.CORRESPONDENCE",`);
    expect(src).toContain(`  ${first}: "${first}",\n  correspondence: "correspondence",`);
  });

  it("each address draws its own „Editează” and edit bar, and its own outline and Esc", () => {
    for (const tile of [first, "correspondence"]) {
      expect(src).toMatch(new RegExp(`titleAction=\\{editButton\\("${tile}", `));
      expect(src).toContain(`after={editBar("${tile}")}`);
      expect(src).toContain(`sectionClassName={editingClass("${tile}").trim()}`);
      expect(src).toContain(`onKeyDown={editKeys("${tile}")}`);
    }
    expect(src).not.toMatch(/editButton\("addresses"|editBar\("addresses"\)|editingClass\("addresses"\)/);
  });

  it("the „aceeași cu…” box is the correspondence tile's footer while it is open; the first address's only on a new record", () => {
    expect(src).toContain(`footer={perTile ? undefined : ${boxConst}}`);
    expect(src).toContain(`footer={perTile && editingTile === "correspondence" ? ${boxConst} : undefined}`);
  });

  it("the same-as line's „Adaugă” opens the correspondence tile", () => {
    expect(src).toContain(`tileEditing.edit("correspondence", '[data-panel="addresses.CORRESPONDENCE"]')`);
    expect(src).not.toMatch(/tileEditing\.edit\("addresses"/);
  });

  it("the tile menu keeps one „Adrese” around both panels", () => {
    expect(src).toContain('<div {...tileProps("addresses")}');
  });
});

describe("41.34 — the juridical person's ANAF fill", () => {
  it("still sends the registered office, the box and the phone with an identity save", () => {
    expect(JP).toContain('const anafKeys: readonly (keyof typeof full)[] = ["addresses", "correspondenceSameAsHq", "phone"];');
  });
});
