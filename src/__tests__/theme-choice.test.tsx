/**
 * Dark mode is one choice, switched by „Noapte" in the sidebar and in „Setări".               (Slices 40.19, 40.28)
 *
 * Adrian, 2026-10-21: „I should be able to switch to this dark mode with a checkbox that shows up in two places".
 * Pinned here: the cookie and what it means; the class on <html> from the server's first byte; the `dark` variant
 * following that class, not Windows' setting; the two boxes showing and changing the one choice. 40.28 (Adrian,
 * 2026-10-22): the sidebar's box under „GA40", labelled „Noapte" / „Night", the flags stacked; „Setări"'s labelled
 * „Noapte (Mod Întunecat)" / „Night (Dark Mode)".
 */
import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { THEME_COOKIE_NAME, applyTheme, themeClass, themeCookie, themeOf } from "@/lib/ui/theme";
import { ThemeProvider } from "@/components/providers/theme-provider";

jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ThemeSwitch, ThemeToggle } = require("@/components/theme-toggle") as typeof import("@/components/theme-toggle");

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

afterEach(() => {
  document.documentElement.classList.remove("dark");
  document.cookie = `${THEME_COOKIE_NAME}=; path=/; max-age=0`;
});

describe("the cookie (Ask first 1)", () => {
  it("ga40-theme: dark is dark, anything else — nothing, a typo — light", () => {
    expect(THEME_COOKIE_NAME).toBe("ga40-theme");
    expect(themeOf("dark")).toBe("dark");
    for (const v of ["light", "Dark", "", undefined, null, "1"]) expect(themeOf(v)).toBe("light");
  });

  it("a year, the whole site, SameSite=Lax — like NEXT_LOCALE", () => {
    expect(themeCookie("dark")).toBe("ga40-theme=dark; path=/; max-age=31536000; SameSite=Lax");
  });

  it("<html> carries `dark` for dark and nothing for light", () => {
    expect(themeClass("dark")).toBe("dark");
    expect(themeClass("light")).toBe("");
  });

  it("applying a theme stores it and turns <html> at once", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain("ga40-theme=dark");
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.cookie).toContain("ga40-theme=light");
  });
});

describe("the account menu's „Zi | Noapte” and Setări's box are one choice (40.59; were two boxes, 40.19)", () => {
  it("„Noapte” turns the page dark and ticks the box; unticking the box turns it light and presses „Zi”", () => {
    render(
      <ThemeProvider initial="light">
        <ThemeSwitch />
        <ThemeToggle />
      </ThemeProvider>,
    );
    const day = screen.getByRole("button", { name: "day" });
    const night = screen.getByRole("button", { name: "night" });
    const settings = screen.getByRole("checkbox", { name: "nightLong" }) as HTMLInputElement;
    expect([day.getAttribute("aria-pressed"), night.getAttribute("aria-pressed"), settings.checked]).toEqual(["true", "false", false]);
    fireEvent.click(night);
    expect([night.getAttribute("aria-pressed"), settings.checked]).toEqual(["true", true]);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    fireEvent.click(settings);
    expect([day.getAttribute("aria-pressed"), settings.checked]).toEqual(["true", false]);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("a dark load shows „Noapte” pressed and the box ticked", () => {
    render(
      <ThemeProvider initial="dark">
        <ThemeSwitch />
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: "night" })).toHaveAttribute("aria-pressed", "true");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });
});

describe("where the choice is read and drawn", () => {
  it("the root layout reads the cookie and writes the class on <html> (no white flash)", () => {
    const layout = read("src", "app", "layout.tsx");
    expect(layout).toContain("themeOf((await cookies()).get(THEME_COOKIE_NAME)?.value)");
    expect(layout).toContain("${themeClass(theme)}");
    expect(layout).toContain("<ThemeProvider initial={theme}>");
  });

  it("`dark:` follows the class, and no rule follows Windows' setting any more (Ask first 2)", () => {
    // A BEHAVIOUR guard: the comments are stripped first — globals.css's own comment says what the blocks were.
    const css = read("src", "app", "globals.css").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).toContain("@custom-variant dark (&:where(.dark, .dark *));");
    expect(css).not.toMatch(/@media\s*\(prefers-color-scheme/);
  });

  it("in the account menu under „Limba” (40.59, Figura 8.3; was the sidebar's header, 40.19/40.28); in „Setări” under „Limba”", () => {
    const sidebar = read("src", "components", "sidebar", "sidebar-nav.tsx");
    expect(sidebar).not.toMatch(/<ThemeToggle|<LocaleToggle|data-sidebar-flags/);
    const menu = read("src", "components", "sidebar", "account-menu.tsx");
    expect(menu).toMatch(/data-account-row="language">[\s\S]*?<LocaleToggle \/>[\s\S]*?data-account-row="appearance">[\s\S]*?<ThemeSwitch \/>/);
    // 40.58: no flags — „RO | EN" (locale-toggle.test.tsx); was 24 × 16 px, stacked (40.19, 40.28).
    expect(read("src", "components", "locale-toggle.tsx")).not.toContain("https://flagcdn");
    const settings = read("src", "app", "admin", "settings", "_components", "settings-view.tsx");
    expect(settings).toMatch(/<LanguageChoice \/>\s*<AppearanceChoice \/>/);
  });

  it("the words, in both languages", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")) as { theme: Record<string, string> };
    const en = JSON.parse(read("messages", "en-GB.json")) as { theme: Record<string, string> };
    expect(ro.theme).toEqual({ day: "Zi", night: "Noapte", nightLong: "Noapte (Mod Întunecat)", appearance: "Aspect" });
    expect(en.theme).toEqual({ day: "Day", night: "Night", nightLong: "Night (Dark Mode)", appearance: "Appearance" });
  });

  it("Setări's box is named by the long words; the sidebar's box is gone (40.59)", () => {
    render(
      <ThemeProvider initial="light">
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(screen.getByRole("checkbox", { name: "nightLong" }).closest("label")).toHaveAttribute("data-theme-toggle", "settings");
    expect(read("src", "components", "theme-toggle.tsx")).not.toMatch(/\bcompact\b/);
  });
});
