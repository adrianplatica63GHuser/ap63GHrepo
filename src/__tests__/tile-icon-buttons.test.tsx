/**
 * Icon-only buttons on the gray tiles; Legături and Părți's two-icon buttons, name links and quiet rows.  (Slice 40.96)
 *
 * Adrian, 2026-10-28: „The Caption of the buttons on the Gray tiles should have only the icon … however, they should
 * keep the hover hint as is". The words stay the button's name and tooltip (`IconButton`'s icon-only form, #37.42).
 * A NAME guard over the tile components — comments included, the safe direction for an attribute that must not come
 * back — plus the pair and the quiet row, rendered.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";
import { Link as LinkIcon, User } from "lucide-react";

import { IconButton } from "@/lib/ui/icon-button";
import { OneLineRow, OneLineRows } from "@/components/tiles/one-line-rows";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

/** Every component that draws a button on a gray tile of the four principal objects (40.96's grep, dialogs excepted). */
const TILE_FILES = [
  "src/components/tiles/read-edit-tile.tsx",
  "src/components/tiles/empty-tile.tsx",
  "src/components/tiles/related-load-error.tsx",
  "src/components/tiles/related-tile.tsx",
  "src/app/_components/person-interactions-tile.tsx",
  "src/app/_components/person-tree-tile.tsx",
  "src/app/natural-persons/_components/person-identity-documents.tsx",
  "src/app/properties/_components/property-form.tsx",
  "src/app/documents/_components/amended-deed-panel.tsx",
  "src/app/documents/_components/document-persons-tab.tsx",
  "src/app/documents/_components/document-references-tab.tsx",
  "src/app/documents/_components/id-card-people-action.tsx",
  "src/app/documents/_components/issuer-field.tsx",
  "src/app/documents/_components/process-panel.tsx",
  "src/components/documents/sale-object-recompose.tsx",
];

describe("no button on the four objects' tiles draws its words (40.96)", () => {
  // 40.98: one place in these files is not on a tile — the property form's „Această parcelă are deja o proprietate"
  // alert, whose „Deschide <name>" links keep their words (#37.42, A016: a column of bare arrows would not say which
  // property each opens). 40.96 took them away with the tile buttons; TC-PROP-16 step 5 caught it.
  const OFF_TILE: Record<string, number> = { "src/app/properties/_components/property-form.tsx": 1 };
  it.each(TILE_FILES)("%s: no showLabel on a tile", (file) => {
    expect((read(...file.split("/")).match(/\bshowLabel\b/g) ?? []).length).toBe(OFF_TILE[file] ?? 0);
  });
  it("the property form's one is the parcel alert's „Deschide <name>”", () => {
    expect(read("src", "app", "properties", "_components", "property-form.tsx")).toMatch(/label=\{t\("parcelExists\.open", \{ name: nameOr\(m\.nickname, "property"\) \}\)\}\s+showLabel/);
  });

  it("the judicial person's „Completează din ANAF” is icon-only too", () => {
    const src = read("src", "app", "judicial-persons", "_components", "judicial-person-form.tsx");
    expect(src).toMatch(/icon=\{Landmark\}\s+label=\{t\("anaf\.button"\)\}\s+variant="secondary"/);
  });

  it("„Editează” and „Adaugă” keep the longer name they had as their tooltip — now their label", () => {
    expect(read("src", "components", "tiles", "read-edit-tile.tsx")).toContain('label={t("editTile", { tile: title })}');
    expect(read("src", "components", "tiles", "empty-tile.tsx")).toContain('label={t("addTo", { tile: title })}');
  });
});

describe("Legături and Părți (40.96)", () => {
  const related = read("src", "components", "tiles", "related-tile.tsx");

  it("„Asociază …” the chain and the kind's icon; „Dezasociază” the chain and the broken chain", () => {
    expect(related).toMatch(/icon=\{LinkIcon\}\s+secondIcon=\{ENTITY_ICON\[a\.kind\]\}/);
    expect(related).toMatch(/icon=\{LinkIcon\}\s+secondIcon=\{Unlink\}\s+label=\{t\("dissociate"\)\}/);
  });

  it("„Înscrisuri citate” the scroll and a magnifier", () => {
    expect(read("src", "app", "documents", "_components", "document-references-tab.tsx")).toMatch(/icon=\{ScrollText\}\s+secondIcon=\{Search\}/);
  });

  it("every caller names the kind it associates; „Asociază persoană” a natural person", () => {
    for (const f of [
      ["src", "app", "documents", "_components", "document-related-tile.tsx"],
      ["src", "app", "natural-persons", "_components", "person-related-tile.tsx"],
      ["src", "app", "properties", "_components", "property-related-tile.tsx"],
    ]) {
      const src = read(...f);
      expect(src).toContain('{ label: t("associatePerson"), kind: "natural",');
      expect(src).toContain('{ label: t("associateProperty"), kind: "property",');
      expect(src).toContain('{ label: t("associateDocument"), kind: "document",');
    }
    expect(read("src", "app", "documents", "_components", "document-parties-tile.tsx")).toContain('{ label: t("associatePerson"), kind: "natural",');
  });
});

describe("the pair, rendered", () => {
  it("two icons in one button, its name the label, no words on screen, wider than the square", () => {
    render(<IconButton icon={LinkIcon} secondIcon={User} label="Asociază persoană" variant="primary" size="sm" />);
    const b = screen.getByRole("button", { name: "Asociază persoană" });
    expect(b.querySelectorAll("svg")).toHaveLength(2);
    expect(b.querySelector("[data-icon-second]")).not.toBeNull();
    expect(b.textContent).toBe("");
    expect(b.className).toContain("w-auto");
    expect(b.className).not.toMatch(/\bw-7\.5\b/);
  });

  it("busy: the spinner alone, the busy name", () => {
    render(<IconButton icon={LinkIcon} secondIcon={User} label="Dezasociază" busy busyLabel="Se dezasociază…" variant="secondary" size="sm" />);
    const b = screen.getByRole("button", { name: "Se dezasociază…" });
    expect(b.querySelectorAll("svg")).toHaveLength(1);
  });
});

describe("a quiet row (40.96, the lists' 40.60)", () => {
  it("the buttons 35 % at rest, full on the hovered or focused row, with a pressed button, and with no hover", () => {
    const { container } = render(
      <OneLineRows slots={["relation", "preview"]} label="Rânduri">
        <OneLineRow selected={false} radioLabel="r" content="Ana" title="Ana" buttons={{ preview: <button type="button">p</button> }} onClick={() => {}} onAuxClick={() => {}} onDoubleClick={() => {}} quiet />
      </OneLineRows>,
    );
    const li = container.querySelector("[data-one-line-row]")!;
    expect(li.className).toContain("group/row");
    const buttons = container.querySelector('[data-row-buttons="quiet"]')!;
    for (const c of ["opacity-35", "group-hover/row:opacity-100", "group-focus-within/row:opacity-100", "has-[[aria-pressed=true]]:opacity-100", "[@media(hover:none)]:opacity-100"]) {
      expect(buttons.className).toContain(c);
    }
  });

  it("a row that is not quiet draws its buttons as before", () => {
    const { container } = render(
      <OneLineRows slots={["preview"]} label="Rânduri">
        <OneLineRow selected={false} radioLabel="r" content="Ana" title="Ana" buttons={{}} onClick={() => {}} onAuxClick={() => {}} onDoubleClick={() => {}} />
      </OneLineRows>,
    );
    expect(container.querySelector("[data-row-buttons]")).toBeNull();
  });
});
