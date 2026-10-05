/**
 * Slice #38.05 — beside a list, the open previews stand in ONE column after the
 * table: the first at the top, the second under it. The column drops below the
 * table only when the window cannot hold the table and one preview side by
 * side; before, the previews were items of the list's wrapping row themselves,
 * and the second wrapped under the TABLE. One component, the four lists.
 * Measured in the browser by TC-TILES-19.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock("@/components/providers/unsaved-changes-provider", () => ({
  useUnsavedChanges: () => ({ guardedNavigate: jest.fn() }),
}));
jest.mock("@/components/tiles/preview-data", () => ({
  loadPreview: async (target: { id: string }) => ({ title: `Teren ${target.id}`, fields: {} }),
}));

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ListPreviews>
        <div data-list-edge="">
          <table>
            <tbody>
              {["A", "B", "C"].map((id) => (
                <tr key={id}>
                  <td>{id}</td>
                  <td data-row={id}>
                    <PreviewButton target={{ kind: "property", id }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListPreviews>
    </QueryClientProvider>,
  );
}
const press = (id: string) => fireEvent.click(document.querySelector(`[data-row="${id}"] button`)!);
const row = () => document.querySelector<HTMLElement>("[data-list-previews]")!;
const column = () => document.querySelector<HTMLElement>("[data-list-preview-column]");

describe("a list's previews stand in one column beside the table (#38.05)", () => {
  it("with none open there is no column — nothing takes a gap in the row", () => {
    renderList();
    expect(column()).toBeNull();
    expect(row().children).toHaveLength(1);
  });

  it("the first opens in a column after the table; the second under it, in the same column", async () => {
    renderList();
    await act(async () => press("A"));
    await waitFor(() => expect(column()?.querySelectorAll("[data-preview]")).toHaveLength(1));
    await act(async () => press("B"));
    await waitFor(() => expect(column()!.querySelectorAll("[data-preview]")).toHaveLength(2));
    // The row holds the table's frame and the column — the previews are never items of the row itself.
    const kids = [...row().children] as HTMLElement[];
    expect(kids).toHaveLength(2);
    expect(kids[0]).toHaveAttribute("data-list-edge");
    expect(kids[1]).toBe(column());
    expect(kids.filter((k) => k.hasAttribute("data-preview"))).toHaveLength(0);
    // A column: one under the other, each at its own width.
    expect(column()!.className).toMatch(/\bflex-col\b/);
    expect(column()!.className).toMatch(/\bitems-start\b/);
    expect(row().className).toMatch(/\bflex-wrap\b/);
    await waitFor(() => expect([...column()!.querySelectorAll("[data-preview] h2")].map((h) => h.textContent)).toEqual(["Teren A", "Teren B"]));
  });

  it("still two at most: a third replaces the oldest, in the same column", async () => {
    renderList();
    for (const id of ["A", "B", "C"]) await act(async () => press(id));
    await waitFor(() => expect([...column()!.querySelectorAll("[data-preview] h2")].map((h) => h.textContent)).toEqual(["Teren B", "Teren C"]));
  });

  it("the four lists draw their table through it", () => {
    for (const dir of ["properties", "documents", "natural-persons", "judicial-persons"]) {
      const view = readFileSync(join(process.cwd(), "src", "app", dir, "list-view.tsx"), "utf8");
      expect([dir, /<ListPreviews>/.test(view)]).toEqual([dir, true]);
    }
  });
});
