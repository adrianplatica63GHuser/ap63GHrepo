/**
 * Slice 40.58 — „RO | EN" as text, no flags from flagcdn.com.
 *
 * Two words in one two-part control: RO first, then EN; the language in use filled in slate and pressed, never faded
 * or disabled; pressing the other writes the cookie and refreshes. No image, and nothing in the source names an
 * outside website. The sidebar and the two sign-in pages draw the one look.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { fireEvent, render, screen } from "@testing-library/react";

const refresh = jest.fn();
let current = "ro-RO";
jest.mock("next-intl", () => ({
  useLocale: () => current,
  useTranslations: () => (key: string) => key,
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LocaleToggle } = require("@/components/locale-toggle") as typeof import("@/components/locale-toggle");

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

describe("„RO | EN” (40.58)", () => {
  beforeEach(() => {
    refresh.mockClear();
    current = "ro-RO";
    document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
  });

  it("two words, RO first, in one group named „Limba”; no image", () => {
    const { container } = render(<LocaleToggle />);
    const group = screen.getByRole("group", { name: "language" });
    expect([...group.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["RO", "EN"]);
    expect(screen.getByRole("button", { name: "Română" })).toHaveAttribute("title", "Română");
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("title", "English");
    expect(container.querySelector("img")).toBeNull();
  });

  it("the language in use is filled and pressed, never faded or disabled; the other outlined", () => {
    render(<LocaleToggle />);
    const ro = screen.getByRole("button", { name: "Română" });
    const en = screen.getByRole("button", { name: "English" });
    expect(ro).toHaveAttribute("aria-pressed", "true");
    expect(en).toHaveAttribute("aria-pressed", "false");
    expect(ro).not.toBeDisabled();
    expect(ro.className).toMatch(/\bbg-cta\b/);
    expect(ro.className).toMatch(/\btext-white\b/);
    expect(ro.className).not.toMatch(/opacity|grayscale/);
    expect(en.className).toMatch(/\bbg-transparent\b/);
    expect(en.className).toMatch(/\btext-ink\b/);
  });

  it("pressing the other writes the cookie and refreshes; pressing the one in use does nothing", () => {
    render(<LocaleToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Română" }));
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(document.cookie).toContain("NEXT_LOCALE=en-GB");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("in English, EN is the one pressed", () => {
    current = "en-GB";
    render(<LocaleToggle />);
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Română" })).toHaveAttribute("aria-pressed", "false");
  });

  it("nothing names flagcdn.com any more", () => {
    for (const f of [["src", "components", "locale-toggle.tsx"], ["next.config.ts"]]) expect(read(...f)).not.toContain("https://flagcdn");
    expect(read("src", "components", "locale-toggle.tsx")).not.toMatch(/\b(small|stacked)\b/);
  });

  it("the sidebar and the two sign-in pages draw the one look", () => {
    expect(read("src", "components", "sidebar", "sidebar-nav.tsx")).toContain("<LocaleToggle />");
    for (const page of ["login", "signup"]) expect(read("src", "app", page, "page.tsx")).toContain("<LocaleToggle />");
  });
});
