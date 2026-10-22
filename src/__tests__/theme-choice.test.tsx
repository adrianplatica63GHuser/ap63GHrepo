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
const { ThemeToggle } = require("@/components/theme-toggle") as typeof import("@/components/theme-toggle");

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

describe("the two boxes are one choice", () => {
  it("ticking one turns the page dark and ticks the other; unticking the other turns it light", () => {
    render(
      <ThemeProvider initial="light">
        <ThemeToggle compact />
        <ThemeToggle />
      </ThemeProvider>,
    );
    const sidebar = screen.getByRole("checkbox", { name: "night" }) as HTMLInputElement;
    const settings = screen.getByRole("checkbox", { name: "nightLong" }) as HTMLInputElement;
    expect([sidebar.checked, settings.checked]).toEqual([false, false]);
    fireEvent.click(sidebar);
    expect([sidebar.checked, settings.checked]).toEqual([true, true]);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    fireEvent.click(settings);
    expect([sidebar.checked, settings.checked]).toEqual([false, false]);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("a dark load shows both ticked", () => {
    render(
      <ThemeProvider initial="dark">
        <ThemeToggle compact />
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect((screen.getAllByRole("checkbox") as HTMLInputElement[]).map((b) => b.checked)).toEqual([true, true]);
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

  it("the sidebar's under „GA40”, the flags stacked apart from it; in „Setări” under „Limba” (40.19 Ask first 3, 40.28)", () => {
    const sidebar = read("src", "components", "sidebar", "sidebar-nav.tsx");
    expect(sidebar).toMatch(/GA40\s*<\/span>\s*<ThemeToggle compact \/>\s*<\/div>/);
    expect(sidebar).toMatch(/data-sidebar-flags="">\s*<LocaleToggle small stacked \/>/);
    expect(sidebar).toContain('"absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"');
    const flags = read("src", "components", "locale-toggle.tsx");
    expect(flags).toContain("small: { width: 24, height: 16 }");
    expect(flags).toContain("regular: { width: 30, height: 20 }");
    expect(flags).toContain('stacked ? "flex flex-col items-center gap-0.5" : "inline-flex items-center gap-1"');
    const settings = read("src", "app", "admin", "settings", "_components", "settings-view.tsx");
    expect(settings).toMatch(/<LanguageChoice \/>\s*<AppearanceChoice \/>/);
  });

  it("the words, in both languages", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")) as { theme: Record<string, string> };
    const en = JSON.parse(read("messages", "en-GB.json")) as { theme: Record<string, string> };
    expect(ro.theme).toEqual({ night: "Noapte", nightLong: "Noapte (Mod Întunecat)", appearance: "Aspect" });
    expect(en.theme).toEqual({ night: "Night", nightLong: "Night (Dark Mode)", appearance: "Appearance" });
  });

  it("the sidebar's box says the long words on hover; its name is the short one (40.28 Ask first 4)", () => {
    render(
      <ThemeProvider initial="light">
        <ThemeToggle compact />
      </ThemeProvider>,
    );
    const box = screen.getByRole("checkbox", { name: "night" });
    expect(box.closest("label")?.getAttribute("title")).toBe("nightLong");
  });
});
