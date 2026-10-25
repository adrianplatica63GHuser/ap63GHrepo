/**
 * Slice 40.59 — the account menu at the bottom of the sidebar (Figura 8.3).
 *
 * The entry (the username, or on the rail its icon) opens a menu upward: „Autentificat ca <name>" first, then Limba
 * (RO | EN), Aspect (Zi | Noapte) and Ieșire — in UAT the uatNoAccounts note instead of Ieșire, and the entry reads
 * „UAT". Enter/Space open it and put the focus inside; Esc closes it and gives the focus back; a press outside closes
 * it; the arrow keys move through it. The sidebar's header holds GA40, in the tiles' title face, and the collapse
 * button only.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("next-intl", () => ({
  useLocale: () => "ro-RO",
  useTranslations: () => (key: string) => key,
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AccountMenu } = require("@/components/sidebar/account-menu") as typeof import("@/components/sidebar/account-menu");

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const menu = () => document.querySelector<HTMLElement>("[data-account-menu]")!;
const entry = () => document.querySelector<HTMLElement>("[data-account-entry]")!;

function openWithKeyboard() {
  entry().focus();
  fireEvent.click(entry()); // Enter / Space on a <button> is a click
  act(() => {
    jest.runOnlyPendingTimers();
  });
}

describe("the account entry and its menu (40.59)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("the entry: the username and its chevron, full width; the menu closed, in the page", () => {
    render(<AccountMenu username="adrian" uat={false} collapsed={false} onSignOut={jest.fn()} />);
    expect(entry().tagName).toBe("BUTTON");
    expect(entry()).toHaveTextContent("adrian");
    expect(entry()).toHaveAttribute("aria-expanded", "false");
    expect(entry()).toHaveAttribute("aria-haspopup", "true");
    expect(entry().className).toContain("w-full");
    expect(menu().hidden).toBe(true);
  });

  it("opened: „Autentificat ca” first, then Limba, Aspect and Ieșire; the focus inside", () => {
    const onSignOut = jest.fn();
    render(<AccountMenu username="adrian" uat={false} collapsed={false} onSignOut={onSignOut} />);
    openWithKeyboard();
    expect(menu().hidden).toBe(false);
    expect(entry()).toHaveAttribute("aria-expanded", "true");
    const lines = [...menu().children].map((c) => c.textContent?.trim());
    expect(lines[0]).toBe("signedInAs adrian");
    expect(menu().querySelector('[data-account-row="language"]')).toHaveTextContent("language");
    expect(menu().querySelector('[data-account-row="appearance"]')).toHaveTextContent("appearance");
    expect(screen.getByRole("group", { name: "language" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "appearance" })).toBeInTheDocument();
    expect(menu().contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "signOut" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("the arrow keys move through it, round at the ends; Esc closes it and gives the focus back", () => {
    render(<AccountMenu username="adrian" uat={false} collapsed={false} onSignOut={jest.fn()} />);
    openWithKeyboard();
    const items = [...menu().querySelectorAll("button")];
    expect(items.map((b) => b.textContent)).toEqual(["RO", "EN", "day", "night", "signOut"]);
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu(), { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu(), { key: "ArrowUp" });
    fireEvent.keyDown(menu(), { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[4]);
    fireEvent.keyDown(menu(), { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(menu().hidden).toBe(true);
    expect(document.activeElement).toBe(entry());
  });

  it("a press outside closes it; one inside does not", () => {
    render(
      <div>
        <span data-testid="outside">x</span>
        <AccountMenu username="adrian" uat={false} collapsed={false} onSignOut={jest.fn()} />
      </div>,
    );
    fireEvent.click(entry());
    fireEvent.pointerDown(screen.getByRole("button", { name: "English" }));
    expect(menu().hidden).toBe(false);
    fireEvent.pointerDown(screen.getByTestId("outside"));
    expect(menu().hidden).toBe(true);
  });

  it("UAT: the entry reads „UAT”; Limba and Aspect, and the note in Ieșire's place", () => {
    render(<AccountMenu username="UAT" uat collapsed={false} onSignOut={jest.fn()} />);
    expect(entry()).toHaveTextContent("UAT");
    fireEvent.click(entry());
    expect(screen.queryByRole("button", { name: "signOut" })).toBeNull();
    expect(menu().querySelector("[data-uat-no-accounts]")).toHaveTextContent("uatNoAccounts");
    expect(menu().querySelector("[data-account-signed-in]")).toBeNull();
    expect(screen.getByRole("group", { name: "language" })).toBeInTheDocument();
  });

  it("on the rail: the User icon alone, the username its name; the same menu", () => {
    render(<AccountMenu username="adrian" uat={false} collapsed onSignOut={jest.fn()} />);
    expect(entry()).toHaveAccessibleName("adrian");
    expect(entry()).not.toHaveTextContent("adrian");
    fireEvent.click(entry());
    expect(menu().hidden).toBe(false);
    expect(menu().className).toContain("fixed");
  });
});

describe("the sidebar (40.59)", () => {
  const sidebar = code(read("src", "components", "sidebar", "sidebar-nav.tsx"));

  it("the header holds GA40, in the tiles' title face, and the collapse button only", () => {
    const head = sidebar.slice(sidebar.indexOf("data-sidebar-look"), sidebar.indexOf("</div>", sidebar.indexOf("PanelLeftOpen : PanelLeftClose")));
    expect(head).toContain("${TILE_TITLE_TYPE} select-none");
    expect(head).toContain("GA40");
    // 40.68: the rail is drawn for a narrow window too — `railShown`, where it read `isCollapsed`.
    expect(head).toContain("icon={railShown ? PanelLeftOpen : PanelLeftClose}");
    expect(head).not.toMatch(/ThemeToggle|LocaleToggle|signedInAs/);
  });

  it("„Autentificat ca” left the top; the bottom strip is the account entry, for UAT too", () => {
    expect(sidebar).not.toContain('t("signedInAs")');
    expect(sidebar).toContain("<AccountMenu username={me?.username} uat={isUatMode} collapsed={railShown} onSignOut={handleLogout} />" /* 40.68 */);
    expect(sidebar).not.toContain("data-uat-no-accounts");
  });

  it("the words, in both languages", () => {
    for (const [f, account, day] of [["ro-RO.json", "Cont", "Zi"], ["en-GB.json", "Account", "Day"]]) {
      const m = JSON.parse(read("messages", f));
      expect([m.nav.account, m.theme.day]).toEqual([account, day]);
    }
  });
});
