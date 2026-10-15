/**
 * Every screen's „?” points at a section of the manual that exists, in both languages.      (Slice #39.40)
 *
 * The registry names the section by id (`manual` on each HELP_SCREENS entry); the popover draws the section's
 * CURRENT number and title, so a renumbered chapter moves every link with it, and only a deleted or renamed id
 * can break one. That is what this suite is for.
 */
import { HELP_SCREENS, helpScreenManualSection } from "@/lib/help/registry";
import { helpManualLink } from "@/lib/help/manual-link";
import { manualHref, manualTarget } from "@/lib/manual/manual";

describe("the help registry's manual sections", () => {
  it.each(HELP_SCREENS.map((s) => [s.key, s.manual] as const))("%s → %s resolves in ro-RO and en-GB", (key, id) => {
    expect(helpScreenManualSection(key)).toBe(id);
    const ro = manualTarget("ro-RO", id);
    const en = manualTarget("en-GB", id);
    expect(ro?.kind).toMatch(/^(chapter|section)$/);
    expect(en?.kind).toBe(ro?.kind);
    expect(en?.number).toBe(ro?.number);
  });

  it("the link the help API sends carries the address and both languages' number and title", () => {
    const link = helpManualLink("admin-tags");
    const id = helpScreenManualSection("admin-tags")!;
    expect(link).toEqual({
      id,
      href: manualHref(id),
      labels: {
        "ro-RO": { number: manualTarget("ro-RO", id)!.number, title: manualTarget("ro-RO", id)!.title },
        "en-GB": { number: manualTarget("en-GB", id)!.number, title: manualTarget("en-GB", id)!.title },
      },
    });
  });

  it("an unregistered screen has no link", () => {
    expect(helpScreenManualSection("nu-exista")).toBeUndefined();
    expect(helpManualLink("nu-exista")).toBeNull();
  });
});
