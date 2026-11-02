/**
 * Slice 41.38 — Adrian: „For all tiles move the Edit button up so it has the same gap to the upper edge of the tile as it
 * has to the right edge of the tile".
 *
 * TileTitle draws `action` on the heading's row, at its right end, the row's items aligned to the top — so the button's
 * top is at the tile's padding, as its right is. The title wraps before it; the subtitle takes the whole width under
 * them. Beside a 30-px action the title's first line is centred on it (3 px down); without one, nothing changes.
 * Every pen goes through TileTitle — the record forms, AddressBlock, ListTile's readEdit slot, the document's Section —
 * and so does the identity documents' „+".
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render } from "@testing-library/react";
import { TileTitle } from "@/components/tiles/tile-title";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

describe("41.38 — „Editează” in the tile's top-right corner", () => {
  it("the action is on the heading's row, at its right end; the subtitle under them", () => {
    const { container } = render(<TileTitle title="Identitate" subtitle="Nume, CNP, naștere" action={<button type="button">E</button>} />);
    const line = container.querySelector("[data-tile-title-line]")!;
    expect(line.className).toMatch(/\bitems-start\b/);
    expect(line.firstElementChild!.tagName).toBe("H2");
    const action = line.querySelector("[data-tile-title-action]")!;
    expect(action.className).toMatch(/\bml-auto\b/);
    expect(action.className).toMatch(/\bshrink-0\b/);
    expect(action.querySelector("button")).not.toBeNull();
    // The heading can shrink (its text wraps before the button), and its first line is centred on the 30-px button.
    expect(line.querySelector("h2")!.className).toMatch(/\bmin-w-0\b/);
    expect(line.querySelector("h2")!.className).toMatch(/mt-\[3px\]/);
    // The subtitle is the whole width, under the row.
    expect(line.nextElementSibling!.hasAttribute("data-tile-subtitle")).toBe(true);
  });

  it("without an action the title is as it was: no row, no offset", () => {
    const { container } = render(<TileTitle title="Legături" subtitle="Persoane, proprietăți, acte" />);
    expect(container.querySelector("[data-tile-title-line]")).toBeNull();
    expect(container.querySelector("h2")!.className).not.toMatch(/mt-\[3px\]/);
  });

  it("every pen and the identity documents' „+” go through TileTitle's action", () => {
    expect(read("src", "components", "address", "address-block.tsx")).toContain("<TileTitle title={title} subtitle={subtitle} action={titleAction} />");
    expect(read("src", "components", "tiles", "list-tile.tsx")).toMatch(/action=\{<span ref=\{setActionSlot\}/);
    expect(read("src", "app", "documents", "_components", "document-form.tsx")).toMatch(/<TileTitle title=\{framed \? panelSubtitle\(title\) : title\} subtitle=\{framed \? undefined : subtitle\} action=\{framed \? undefined : action\} \/>/);
    expect(read("src", "app", "natural-persons", "_components", "person-identity-documents.tsx")).toContain("<TileTitle title={title} subtitle={subtitle} action={addButton} />");
  });
});
