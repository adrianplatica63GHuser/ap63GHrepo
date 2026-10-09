/**
 * „Recente" folds into one bar above the footer               (Slice #38.28)
 *
 * Adrian: „by default it should not be expanded … it should be one bar". The
 * panel is one button — the history icon, the word, a chevron — folded on
 * first render; a click unfolds the recently viewed records (under it since
 * #38.63; above it until then), and a second folds them. With nothing visited the bar is still there and says so
 * when unfolded; collapsed to icons, it is the icon alone and expands the
 * sidebar.
 */
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: ReactNode; href: string }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("react") as typeof import("react")).createElement("a", { href }, children),
}));
jest.mock("@/components/providers/unsaved-changes-provider", () => ({
  useUnsavedChanges: () => ({ guardedNavigate: () => undefined }),
}));

let entries: { href: string; label: string; code: string; entityType: string; id: string }[] = [];
jest.mock("@/components/providers/navigation-history-provider", () => ({
  useNavigationHistory: () => ({ recentlyViewed: entries }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RecentlyViewedPanel } = require("@/components/recently-viewed-panel") as typeof import("@/components/recently-viewed-panel");

const TWO = [
  { href: "/properties/1", label: "TC-E2E Proprietate unu", code: "PROP00001", entityType: "PROPERTY", id: "1" },
  { href: "/documents/2", label: "TC-E2E Act doi", code: "DOC00002", entityType: "DOCUMENT", id: "2" },
];

const bar = () => screen.getByRole("button", { name: /title/ });

beforeEach(() => {
  entries = TWO;
});

describe("„Recente” is one bar, folded by default (#38.28)", () => {
  it("is folded on first render: the bar shows its word, and no record", () => {
    render(<RecentlyViewedPanel isCollapsed={false} />);
    expect(bar()).toHaveAttribute("aria-expanded", "false");
    expect(bar()).toHaveTextContent("title");
    expect(screen.queryByText("TC-E2E Proprietate unu")).toBeNull();
    expect(screen.queryByText("TC-E2E Act doi")).toBeNull();
  });

  it("one click unfolds the records, a second folds them; aria-expanded follows", () => {
    render(<RecentlyViewedPanel isCollapsed={false} />);
    fireEvent.click(bar());
    expect(bar()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("TC-E2E Proprietate unu")).toBeInTheDocument();
    expect(screen.getByText("TC-E2E Act doi")).toBeInTheDocument();
    fireEvent.click(bar());
    expect(bar()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("TC-E2E Proprietate unu")).toBeNull();
  });

  // #38.28: „the list sits ABOVE the bar" — the bar came after the list (DOCUMENT_POSITION_FOLLOWING), so the
  // list grew upwards. #38.63, Adrian: the bar on top, the list opening under it like an accordion.
  it("names the list it controls, and the list sits UNDER the bar (#38.63)", () => {
    const { container } = render(<RecentlyViewedPanel isCollapsed={false} />);
    fireEvent.click(bar());
    const id = bar().getAttribute("aria-controls");
    expect(id).toBeTruthy();
    const list = container.ownerDocument.getElementById(id!);
    expect(list).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING: the list comes after the bar — the bar is the panel's top line.
    expect(bar().compareDocumentPosition(list!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const panel = container.querySelector("[data-recent-panel]")!;
    expect(panel.firstElementChild).toBe(bar());
  });

  it("points its chevron like a sidebar section's: down while folded, up while unfolded (#38.63)", () => {
    const { container } = render(<RecentlyViewedPanel isCollapsed={false} />);
    const chevron = () => bar().querySelector("svg:last-of-type")!;
    expect(chevron().getAttribute("class")).not.toContain("rotate-180");
    fireEvent.click(bar());
    expect(chevron().getAttribute("class")).toContain("rotate-180");
    // The footer-facing outline the ten specs mask by is still the panel's outer div.
    expect(container.querySelector("div.border-t[data-recent-panel]")).not.toBeNull();
  });

  it("with nothing visited, the bar is still shown, and unfolded says so", () => {
    entries = [];
    render(<RecentlyViewedPanel isCollapsed={false} />);
    expect(bar()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("empty")).toBeNull();
    fireEvent.click(bar());
    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("collapsed to icons: the icon alone, named; a click expands the sidebar", () => {
    const expand = jest.fn();
    render(<RecentlyViewedPanel isCollapsed onExpandSidebar={expand} />);
    const icon = screen.getByRole("button", { name: "title" });
    expect(icon).not.toHaveAttribute("aria-expanded");
    expect(icon.textContent).toBe("");
    fireEvent.click(icon);
    expect(expand).toHaveBeenCalledTimes(1);
  });

  it("collapsed, then expanded by that click: the list is unfolded", () => {
    const { rerender } = render(<RecentlyViewedPanel isCollapsed onExpandSidebar={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "title" }));
    rerender(<RecentlyViewedPanel isCollapsed={false} onExpandSidebar={() => undefined} />);
    expect(bar()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("TC-E2E Act doi")).toBeInTheDocument();
  });
});
