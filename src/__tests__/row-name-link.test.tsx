/**
 * Slice 40.60 — the rows' buttons: no arrow, the name a link, the other three quiet.
 *
 * The name in each row of the four lists is a real <a href> to the record: a plain click is left to the row (which opens
 * the record), every other click is the browser's and the row is not told. It looks as the text did, underlined on
 * hover and focus. On Acte, whose first cell is the type, the link is the title.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { fireEvent, render, screen } from "@testing-library/react";

import { RowNameLink } from "@/components/list/row-name-link";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

function inRow(onRow: jest.Mock, onAux: jest.Mock) {
  render(
    <table>
      <tbody>
        <tr onClick={onRow} onAuxClick={onAux}>
          <td>
            <RowNameLink href="/natural-persons/1">Ion Popescu</RowNameLink>
          </td>
        </tr>
      </tbody>
    </table>,
  );
  return screen.getByRole("link", { name: "Ion Popescu" });
}

describe("RowNameLink (40.60)", () => {
  it("is a real link to the record, looking as the text did", () => {
    const link = inRow(jest.fn(), jest.fn());
    expect(link).toHaveAttribute("href", "/natural-persons/1");
    expect(link.className).toMatch(/\bno-underline\b/);
    expect(link.className).toMatch(/\bhover:underline\b/);
    expect(link.className).toMatch(/\bfocus-visible:underline\b/);
    expect(link.className).toMatch(/\btext-inherit\b/);
  });

  it("a plain click (and Enter) is the row's: the browser does not follow it, the row's click runs", () => {
    const onRow = jest.fn();
    const link = inRow(onRow, jest.fn());
    const plain = fireEvent.click(link, { button: 0 });
    expect(plain).toBe(false); // default prevented
    expect(onRow).toHaveBeenCalledTimes(1);
  });

  it("Ctrl/⌘, Shift and the middle button are the browser's; the row is not told", () => {
    const onRow = jest.fn();
    const onAux = jest.fn();
    const link = inRow(onRow, onAux);
    for (const over of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
      expect(fireEvent.click(link, { button: 0, ...over })).toBe(true); // not prevented
    }
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
    expect(onRow).not.toHaveBeenCalled();
    expect(onAux).not.toHaveBeenCalled();
  });

  it("an empty name is named „Deschide”", () => {
    render(<RowNameLink href="/properties/1" emptyLabel="Deschide">—</RowNameLink>);
    expect(screen.getByRole("link", { name: "Deschide" })).toBeInTheDocument();
  });

  it.each([
    ["natural-persons", "/natural-persons/"],
    ["judicial-persons", "/judicial-persons/"],
    ["properties", "/properties/"],
    ["documents", "/documents/"],
  ])("%s: the list's name cell is the link, and the row is its group", (dir, base) => {
    const view = read("src", "app", dir, "list-view.tsx");
    expect(view).toContain(`<RowNameLink href={\`${base}\${item.id}\`}`);
    expect(view).toMatch(/className="group\/row /);
    expect(view).not.toMatch(/icon=\{ArrowRight\}\s+label=\{t\("open"\)\}/);
  });

  it("on Acte the link is the title — the first cell is the type", () => {
    const view = read("src", "app", "documents", "list-view.tsx");
    const title = view.indexOf('key === "title" ? (');
    expect(view.indexOf("<RowNameLink", title)).toBeGreaterThan(title);
    expect(view.slice(view.indexOf("<FirstCellText"), title)).not.toContain("<RowNameLink");
  });
});
