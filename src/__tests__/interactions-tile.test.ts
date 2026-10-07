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
  it.each([["natural person", NP_TILE_REGISTRY], ["judicial person", JP_TILE_REGISTRY]] as const)("%s: in placement.right, in the purple group", (_n, reg) => {
    expect(reg.placement?.right).toContain("interactions");
    expect(tileGroupOf(reg as never, "interactions" as never)).toBe("fixed");
  });

  // #38.30 inverts #37.89 for the Natural Person: „off by default until it is built". It stays
  // tickable. The Judicial Person keeps it ticked — the request names the Natural Person only.
  it("is not ticked by default on the Natural Person, and still is on the Judicial Person", () => {
    expect(NP_TILE_REGISTRY.defaults).not.toContain("interactions");
    expect(NP_TILE_REGISTRY.all).toContain("interactions");
    expect(JP_TILE_REGISTRY.defaults).toContain("interactions");
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

// #38.30: „Identitate” (#37.89) became „Date de înregistrare”. The panel's heading reads the tile's
// key since #38.30, so there is no separate section key left to agree with it.
describe("the Judicial Person's first tile is „Date de înregistrare”", () => {
  it("in both languages, and the form's heading reads the tile's own key", () => {
    const ro = msg("ro-RO.json"), en = msg("en-GB.json");
    expect(ro.judicialPerson.tiles.identity).toBe("Date de înregistrare");
    expect(en.judicialPerson.tiles.identity).toBe("Registration details");
    expect(ro.judicialPerson.sections.identity).toBeUndefined();
    const form = fs.readFileSync(path.join(process.cwd(), "src", "app", "judicial-persons", "_components", "judicial-person-form.tsx"), "utf8");
    expect(form).toContain('<TileTitle title={t("tiles.identity")}');
  });
});

describe("„Interacțiuni”'s sentence, in italics and in parentheses (#38.06)", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src", "components", "tiles", "interactions-tile.tsx"), "utf8");
  it("is drawn in italics, the parentheses around the message", () => {
    expect(src).toMatch(/<p className="[^"]*\bitalic\b[^"]*" data-interactions-note="">\s*\(\{t\("interactionsPlaceholder"\)\}\)\s*<\/p>/);
  });
  it("the message itself stays a plain sentence, with no parentheses, in both files", () => {
    for (const f of ["ro-RO.json", "en-GB.json"]) {
      expect(msg(f).shared.tiles.interactionsPlaceholder).not.toMatch(/[()]/);
    }
  });
});
