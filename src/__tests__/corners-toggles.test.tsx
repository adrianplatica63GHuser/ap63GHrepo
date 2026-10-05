/**
 * The corners manager's tools are icons, and its two toggles show their state.
 *                                                                (Slice #37.45)
 *
 * „Arată / Ascunde Street View" (A059) is PersonStanding and „Arată / Ascunde
 * Unghiuri" (A058) is DraftingCompass: one button each, `aria-pressed` and the
 * cta fill while on, and a name — and so a tooltip — that follows the state as
 * the words did. The rows' „↑" / „↓" (A068) are ArrowUp / ArrowDown, named by
 * the hint they carried; „+ Adaugă punct" (A067) is MapPinPlus.
 *
 * `useTranslations` returns the key, so the buttons are found by their
 * `property.corners.*` keys.
 */
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CornersManager } from "@/app/properties/_components/corners-manager";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock("@/components/help/help-hint", () => ({ HelpHint: () => null }));

const CORNERS = [
  { lat: 44.37, lon: 25.98 },
  { lat: 44.371, lon: 25.981 },
  { lat: 44.372, lon: 25.979 },
];

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch;
});

function renderManager(props: { streetView?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CornersManager
        corners={CORNERS}
        onChange={() => undefined}
        onToggleStreetView={() => undefined}
        {...props}
      />
    </QueryClientProvider>,
  );
}

function hover(el: Element) {
  const ev = createEvent.pointerOver(el);
  Object.defineProperty(ev, "pointerType", { value: "mouse" });
  fireEvent(el, ev);
}

function iconClass(button: HTMLElement): string {
  return button.querySelector("svg")?.getAttribute("class") ?? "";
}

// Slice #38.09: only „Adaugă proprietate" still gives the corners section its Street View
// toggle; the angles toggle left it for the map's top row (map-top-row-angles.test.ts).
describe.each([
  ["Street View", "streetView", "showStreetView", "hideStreetView", "lucide-person-standing"],
] as const)("the %s toggle", (_what, prop, offName, onName, icon) => {
  it("off: its icon, not pressed, the name and tooltip saying what a press does", () => {
    renderManager({ [prop]: false });
    const b = screen.getByRole("button", { name: offName });
    expect(iconClass(b)).toContain(icon);
    expect(b).toHaveAttribute("aria-pressed", "false");
    expect(b.className.split(" ")).not.toContain("bg-cta");
    hover(b);
    expect(screen.getByRole("tooltip")).toHaveTextContent(offName);
  });

  it("on: pressed, the cta fill, and the name and tooltip follow the state", () => {
    renderManager({ [prop]: true });
    expect(screen.queryByRole("button", { name: offName })).toBeNull();
    const b = screen.getByRole("button", { name: onName });
    expect(iconClass(b)).toContain(icon);
    expect(b).toHaveAttribute("aria-pressed", "true");
    expect(b.className.split(" ")).toContain("bg-cta");
    hover(b);
    expect(screen.getByRole("tooltip")).toHaveTextContent(onName);
  });
});

describe("the rows' arrows and the add button", () => {
  it("↑ / ↓ are ArrowUp / ArrowDown, named by the hint they carried; the ends are disabled", () => {
    renderManager();
    const ups = screen.getAllByRole("button", { name: "moveUp" });
    const downs = screen.getAllByRole("button", { name: "moveDown" });
    expect(ups).toHaveLength(3);
    expect(downs).toHaveLength(3);
    expect(iconClass(ups[0])).toContain("lucide-arrow-up");
    expect(iconClass(downs[0])).toContain("lucide-arrow-down");
    expect(ups[0]).toBeDisabled();
    expect(downs[2]).toBeDisabled();
    expect(screen.queryByRole("button", { name: "↑" })).toBeNull();
  });

  it("„+ Adaugă punct” is MapPinPlus, keeping its name", () => {
    renderManager();
    expect(iconClass(screen.getByRole("button", { name: "+ add" }))).toContain("lucide-map-pin-plus");
  });
});

describe("no angles button in the corners tile (#38.09)", () => {
  it("whatever the form passes, the corners toolbar draws no DraftingCompass", () => {
    renderManager();
    expect(screen.queryByRole("button", { name: "showAngles" })).toBeNull();
    expect(screen.queryByRole("button", { name: "hideAngles" })).toBeNull();
    expect(document.querySelector(".lucide-drafting-compass")).toBeNull();
  });
});
