/**
 * @jest-environment jsdom
 *
 * Where a tile can be grabbed: its unused space only.            (Slice #37.76)
 *
 * jsdom has no layout, so the text under the pointer is checked against the
 * rectangles the test gives `Range.getClientRects`. The browser half is
 * TC-TILES-13 (a press on „Nume" and on its label starts no drag).
 */
import { NOT_A_SURFACE, isDragSurface, textUnder } from "@/components/tiles/tile-drag-surface";

function tile(html: string): HTMLElement {
  document.body.innerHTML = `<section data-tile="t" class="p-3">${html}</section>`;
  return document.querySelector("section")!;
}

describe("a tile's unused space", () => {
  const original = Range.prototype.getClientRects;
  afterEach(() => {
    Range.prototype.getClientRects = original;
  });

  it("its own surface and the gaps between its fields start a drag", () => {
    const box = tile('<div class="row"><div class="gap"></div></div><h2>Conexiuni</h2>');
    expect(isDragSurface(box, 5, 5, box)).toBe(true);
    expect(isDragSurface(box.querySelector(".gap"), 5, 5, box)).toBe(true);
  });

  it.each([
    ["an input", "<input />", "input"],
    ["a select", "<select><option>a</option></select>", "select"],
    ["a textarea", "<textarea></textarea>", "textarea"],
    ["a button's icon", '<button><svg><path d="M0"/></svg></button>', "path"],
    ["a link", '<a href="#"><span>x</span></a>', "span"],
    ["a label", '<label><span class="t">Nume</span></label>', ".t"],
    ["an image", '<img alt="" />', "img"],
    ["the page viewer", '<iframe title="p"></iframe>', "iframe"],
    ["a map", '<div class="gm-style"><div class="pane"></div></div>', ".pane"],
    ["a radio by role", '<div role="radio"></div>', '[role="radio"]'],
  ])("%s does not", (_name, html, sel) => {
    const box = tile(html);
    expect(isDragSurface(box.querySelector(sel), 5, 5, box)).toBe(false);
  });

  it("anything that draws its own cursor does not (a clickable row, a resize handle)", () => {
    const box = tile('<div class="row" style="cursor: pointer"><div class="in"></div></div>');
    expect(isDragSurface(box.querySelector(".in"), 5, 5, box)).toBe(false);
  });

  it("text under the pointer does not; beside it, in the same element, does", () => {
    const box = tile("<h2>Clasificare subiectivă</h2>");
    const h2 = box.querySelector("h2")!;
    Range.prototype.getClientRects = function () {
      return [{ left: 10, right: 200, top: 10, bottom: 30 }] as unknown as DOMRectList;
    };
    expect(textUnder(h2, 50, 20)).toBe(true);
    expect(isDragSurface(h2, 50, 20, box)).toBe(false);
    // The free part of the title row, right of the words.
    expect(isDragSurface(h2, 400, 20, box)).toBe(true);
  });

  it("a press outside the tile is not its surface", () => {
    const box = tile("");
    const other = document.createElement("div");
    document.body.appendChild(other);
    expect(isDragSurface(other, 5, 5, box)).toBe(false);
    expect(isDragSurface(null, 5, 5, box)).toBe(false);
  });

  it("names every kind of control Adrian listed", () => {
    for (const s of ["input", "select", "textarea", "button", "a", "label", "img", "iframe", ".gm-style"]) expect(NOT_A_SURFACE.split(",")).toContain(s);
  });
});
