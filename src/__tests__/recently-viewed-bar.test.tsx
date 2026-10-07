/**
 * „Recente" folds into one bar above the footer               (Slice #38.28)
 *
 * Adrian: „by default it should not be expanded … it should be one bar". The
 * panel is one button — the history icon, the word, a chevron — folded on
 * first render; a click unfolds the recently viewed records above it, and a
 * second folds them. With nothing visited the bar is still there and says so
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

  it("names the list it controls, and the list sits ABOVE the bar", () => {
    const { container } = render(<RecentlyViewedPanel isCollapsed={false} />);
    fireEvent.click(bar());
    const id = bar().getAttribute("aria-controls");
    expect(id).toBeTruthy();
    const list = container.ownerDocument.getElementById(id!);
    expect(list).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING: the bar comes after the list, so the list grows upwards.
    expect(list!.compareDocumentPosition(bar()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
