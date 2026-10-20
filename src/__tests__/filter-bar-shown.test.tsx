/**
 * The filter bar is a row only while a filter is active.                                         (Slice #40.01)
 *
 * Adrian, 2026-10-20: „a second row is only needed if we have filters and we need to show their description and
 * button "clear filters"". With nothing active the bar is drawn out of the flow — no height, and no gap in the list's
 * column — and still holds the editor a column's funnel opens (Ask first 3, 6). On all four lists, since the bar is
 * one component. The real bar over a real query cache; only the translations are mocked, so controls are found by
 * their keys. The browser half — no space taken, the row appearing and going — is TC-DOC-08 step 10.
 */
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

import { FilterBar, type FilterBarField } from "@/components/list/filter-bar";
import type { FilterState } from "@/lib/list/filter-bar";

const FIELDS: FilterBarField[] = [{ key: "cad", kind: "text", label: "Nr. cadastral" }];

function draw(state: FilterState, editing: string | null = null) {
  const client = new QueryClient();
  const { container } = render(
    <QueryClientProvider client={client}>
      <FilterBar
        fields={FIELDS}
        state={state}
        onChange={() => {}}
        editing={editing}
        onEditing={() => {}}
        loadValues={async () => []}
        valuesKey={(k) => ["t", k]}
      />
    </QueryClientProvider>,
  );
  return container.querySelector<HTMLElement>("[data-filter-bar]")!;
}

describe("the filter bar while nothing is active", () => {
  it("is out of the flow: no row, no chip, no „Șterge filtrele”", () => {
    const bar = draw({});
    expect(bar.dataset.filterBarShown).toBe("false");
    expect(bar.className).toBe("absolute");
    expect(bar.querySelector("[data-filter-chip]")).toBeNull();
    expect(screen.queryByRole("button", { name: "clearAll" })).toBeNull();
  });

  it("still holds the editor a funnel opened", () => {
    const bar = draw({}, "cad");
    expect(bar.querySelector('[data-filter-editor="cad"]')).not.toBeNull();
    expect(screen.getByRole("dialog", { name: "Nr. cadastral" })).toBeTruthy();
  });
});

describe("the filter bar while a filter is active", () => {
  it("is a row: the chip, naming its field, and „Șterge filtrele”", () => {
    const bar = draw({ cad: { kind: "text", text: "1234" } });
    expect(bar.dataset.filterBarShown).toBe("true");
    expect(bar.className).toBe("relative flex flex-wrap items-center gap-2");
    expect(bar.querySelector('[data-filter-chip="cad"]')?.textContent).toContain("Nr. cadastral");
    expect(screen.getByRole("button", { name: "clearAll" })).toBeTruthy();
  });
});
