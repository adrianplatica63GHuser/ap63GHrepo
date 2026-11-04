/**
 * Slice 41.72 — the tree tile's two composed icons (`@/lib/ui/person-badge-icons`): a person with a chain link
 * („Adaugă o rudă") and a person with a bin („Scoate o rudă"), each taking a Lucide icon's size, colour and stroke.
 */
import { render } from "@testing-library/react";

const markup = (el: React.ReactElement) => render(el).container.innerHTML;
import { PersonBinIcon, PersonLinkIcon } from "@/lib/ui/person-badge-icons";

describe("the person-and-badge icons", () => {
  it.each([
    [PersonLinkIcon, "PersonLinkIcon", "lucide-link"],
    [PersonBinIcon, "PersonBinIcon", "lucide-trash"],
  ])("%p draws a person and its badge at the size and colour asked", (Icon, name, badge) => {
    const html = markup(<Icon size={16} color="red" aria-hidden="true" className="shrink-0" />);
    expect(html).toMatch(/^<svg[^>]* width="16" height="16"/);
    expect(html).toContain(`data-composed-icon="${name}"`);
    expect(html).toContain('class="lucide shrink-0"');
    expect(html).toContain("lucide-user");
    expect(html).toContain(badge);
    expect(html.match(/stroke="red"/g)?.length).toBe(2);
  });

  it("keeps a 2-px line: each nested icon's stroke scaled up by what its box shrinks it", () => {
    const html = markup(<PersonLinkIcon />);
    const widths = [...html.matchAll(/<svg[^>]* width="(\d+)"[^>]* stroke-width="([\d.]+)"/g)].map((m) => (Number(m[1]) * Number(m[2])) / 24);
    expect(widths.map((w) => Math.round(w * 100) / 100)).toEqual([2, 2]);
  });
});
