/**
 * Slice #37.89 — „Interacțiuni", a placeholder tile fixed at the right of the
 * two person forms, purple, as large as a Document's „Pagini"; and the Judicial
 * Person's first tile is called „Identitate".
 */
import fs from "fs";
import path from "path";
import { NP_TILE_REGISTRY } from "@/app/natural-persons/_components/person-tiles";
import { JP_TILE_REGISTRY } from "@/app/judicial-persons/_components/person-tiles";
import { tileGroupOf } from "@/lib/ui/tiles";
import { INTERACTIONS_TILE_STYLE, PAGES_PANEL_STYLE } from "@/lib/ui/field-widths";

const msg = (f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", f), "utf8"));

describe("„Interacțiuni” on both person registries", () => {
  it.each([["natural person", NP_TILE_REGISTRY], ["judicial person", JP_TILE_REGISTRY]] as const)("%s: in placement.right, in the purple group, ticked by default", (_n, reg) => {
    expect(reg.placement?.right).toContain("interactions");
    expect(tileGroupOf(reg as never, "interactions" as never)).toBe("fixed");
    expect(reg.defaults).toContain("interactions");
  });

  it("is as wide as „Pagini”", () => {
    expect(INTERACTIONS_TILE_STYLE.width).toBe(PAGES_PANEL_STYLE.width);
  });

  it("names itself and says what it is, in both languages", () => {
    const ro = msg("ro-RO.json"), en = msg("en-GB.json");
    expect(ro.naturalPerson.tiles.interactions).toBe("Interacțiuni");
    expect(ro.judicialPerson.tiles.interactions).toBe("Interacțiuni");
    expect(en.naturalPerson.tiles.interactions).toBe("Interactions");
    expect(ro.shared.tiles.interactionsPlaceholder).toBe("Modulul de gestionare a interacțiunilor va fi dezvoltat în viitor.");
    expect(en.shared.tiles.interactionsPlaceholder).toBe("The interaction-management module will be developed in the future.");
  });
});

describe("the Judicial Person's first tile is „Identitate”", () => {
  it("as tile and as section, in both languages", () => {
    const ro = msg("ro-RO.json"), en = msg("en-GB.json");
    expect([ro.judicialPerson.tiles.identity, ro.judicialPerson.sections.identity]).toEqual(["Identitate", "Identitate"]);
    expect([en.judicialPerson.tiles.identity, en.judicialPerson.sections.identity]).toEqual(["Identity", "Identity"]);
  });
});
