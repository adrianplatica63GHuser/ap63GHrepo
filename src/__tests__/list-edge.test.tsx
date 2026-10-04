/**
 * Slice #37.84 — a list's right edge. On the four lists the toolbar's group
 * („Șterge selectate", ⓘ, „Adaugă …") ends at the table frame's right edge:
 * the toolbar is never narrower than the table's columns, and the frame and
 * the pagination row are never narrower than the toolbar as drawn — so
 * whichever is wider, the columns or the controls, sets the list's width.
 * The browser half — the edges to the pixel, at 1366 and 1920 — is TC-LAYOUT-02.
 */
import fs from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";

import { FRAME_BORDERS_PX, LIST_TOOLBAR, columnsEdge, frameEdgeStyle, toolbarEdgeStyle, useListEdge } from "@/components/table/list-edge";
import { columnsRem, type ColumnName } from "@/lib/ui/field-widths";

const FEW: ColumnName[] = ["selectNew", "personName", "openPreview"];
const MORE: ColumnName[] = ["selectNew", "personName", "personNickname", "openPreview"];

describe("a list's right edge (Slice #37.84)", () => {
  it("the columns' edge is the sum of the columns plus the frame's two borders", () => {
    expect(FRAME_BORDERS_PX).toBe(2);
    expect(columnsEdge(FEW)).toBe(`calc(${columnsRem(FEW)}rem + 2px)`);
  });

  it("the toolbar is never narrower than the columns, and follows them when one is added", () => {
    expect(LIST_TOOLBAR).toBe("w-fit max-w-full");
    expect(toolbarEdgeStyle(FEW)).toEqual({ minWidth: `min(calc(${columnsRem(FEW)}rem + 2px), 100%)` });
    expect(toolbarEdgeStyle(MORE).minWidth).toContain(`${columnsRem(MORE)}rem`);
    expect(columnsRem(MORE)).toBeGreaterThan(columnsRem(FEW));
  });

  it("the frame and the pagination row are never narrower than the toolbar as drawn, nor than the columns", () => {
    expect(frameEdgeStyle(FEW, 1200)).toEqual({ minWidth: `min(max(1200px, calc(${columnsRem(FEW)}rem + 2px)), 100%)` });
    // Before the toolbar is measured, the columns alone.
    expect(frameEdgeStyle(FEW, null)).toEqual({ minWidth: `min(calc(${columnsRem(FEW)}rem + 2px), 100%)` });
    expect(frameEdgeStyle(FEW, 0)).toEqual(frameEdgeStyle(FEW, null));
  });

  it("the hook measures the toolbar it is attached to", () => {
    const spy = jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1234);
    function List() {
      const edge = useListEdge(FEW);
      return (
        <div>
          <div className={LIST_TOOLBAR} {...edge.toolbar} />
          <div {...edge.frame} />
        </div>
      );
    }
    const { container } = render(<List />);
    const toolbar = container.querySelector("[data-list-toolbar]") as HTMLElement;
    const frame = container.querySelector("[data-list-edge]") as HTMLElement;
    expect(toolbar.style.minWidth).toContain(`${columnsRem(FEW)}rem`);
    expect(frame.style.minWidth).toContain("1234px");
    spy.mockRestore();
  });

  it("all four lists use it: the toolbar, the table frame and the pagination row", () => {
    for (const list of ["natural-persons", "judicial-persons", "properties", "documents"]) {
      const src = fs.readFileSync(path.join(process.cwd(), "src", "app", list, "list-view.tsx"), "utf8");
      expect(src).toContain("useListEdge(");
      expect(src).toContain("{...edge.toolbar}");
      expect(src).toMatch(/\$\{TABLE_FRAME\}[^`]*`\}\s*\{\.\.\.edge\.frame\}/);
      // The pagination row, under the table.
      expect(src.split("{...edge.frame}").length - 1).toBeGreaterThanOrEqual(2);
    }
  });
});
