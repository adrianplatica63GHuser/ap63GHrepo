/**
 * Slice 40.61 — one mark for each kind of record, everywhere.
 *
 * ENTITY_ICON is the one map; Legături's RELATED_ICON is it; the sidebar's four entries and the record headings draw
 * it; „Activitate recentă" and the global search show the kind as its mark, named by the kind's words; the dashboard's
 * counts stand in one ink colour on plain cards, each under its kind's mark.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";
import { Building2, FileText, Map as MapIcon, User } from "lucide-react";

import { EntityMark } from "@/components/record/entity-mark";
import { NAV_SECTIONS } from "@/components/sidebar/nav-config";
import { ENTITY_ICON } from "@/lib/ui/entity-icon";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("one mark for each kind (40.61)", () => {
  it("the four marks, defined once", () => {
    expect(ENTITY_ICON).toEqual({ natural: User, judicial: Building2, property: MapIcon, document: FileText });
  });

  it("Legături's icons are the same map (Ask first 1)", () => {
    // Read, not imported: related-tile.tsx pulls next-intl's ESM build, which jest does not transform.
    expect(code(read("src", "components", "tiles", "related-tile.tsx"))).toContain(
      "export const RELATED_ICON: Readonly<Record<RelatedKind, ComponentType<LucideProps>>> = ENTITY_ICON;",
    );
  });

  it("the sidebar's four entries draw them", () => {
    const items = NAV_SECTIONS.flatMap((s) => s.items);
    const icon = (key: string) => items.find((i) => i.key === key)?.icon;
    expect([icon("naturalPeople"), icon("judicialPeople"), icon("propertyList"), icon("document")]).toEqual([
      ENTITY_ICON.natural,
      ENTITY_ICON.judicial,
      ENTITY_ICON.property,
      ENTITY_ICON.document,
    ]);
  });

  it("a mark is an image named by the kind's words, which are its tooltip too", () => {
    render(<EntityMark kind="judicial" label="Persoană juridică" />);
    const mark = screen.getByRole("img", { name: "Persoană juridică" });
    expect(mark).toHaveAttribute("title", "Persoană juridică");
    expect(mark).toHaveAttribute("data-entity-mark", "judicial");
    expect(mark.className).not.toMatch(/font-mono/);
  });
});

describe("where the marks replaced words and colours", () => {
  const dash = code(read("src", "app", "_components", "dashboard-client.tsx"));
  const search = code(read("src", "app", "(all-roles)", "admin", "global-search", "_components", "global-search-view.tsx"));

  it("„Activitate recentă”: the kind's mark, no monospace word (Ask first 3)", () => {
    expect(dash).toContain("<EntityMark kind={kindOf(item)} label={t(KIND_LABEL_KEY[kindOf(item)])} />");
    expect(dash).not.toContain("ENTITY_TYPE_LABEL_KEY");
    expect(dash).not.toMatch(/font-mono text-zinc-500/);
  });

  it("the counts: ink numbers on white cards with the wire border, each under its kind's mark (Ask first 4)", () => {
    const counts = dash.slice(dash.indexOf("export function RecentCountsSection"), dash.indexOf("export function", dash.indexOf("export function RecentCountsSection") + 10));
    expect(counts).toContain('className="text-3xl font-bold tabular-nums text-ink dark:text-zinc-100"');
    expect(counts).toContain("rounded-lg border border-wire bg-white p-4");
    expect(counts).toContain("dark:border-zinc-700 dark:bg-zinc-900");
    expect(counts).toContain("const Icon = ENTITY_ICON[c.kind];");
    expect(counts).not.toMatch(/text-(blue|emerald|violet)-600|bg-(blue|emerald|violet)-50/);
  });

  it("the global search: the kind's mark, a person's natural or juridical; the codes keep monospace", () => {
    expect(search).toContain("<EntityMark kind={kind} label={label} />");
    expect(search).not.toMatch(/function (badgeClass|personTypeBadge)\b/);
    expect(search).toMatch(/font-mono text-xs font-medium text-indigo-800/); // a group's code
    expect(search).toMatch(/font-mono text-xs font-medium text-teal-800/); // a stamp's code
  });

  it("every key the dashboard's marks read is in both message files", () => {
    for (const f of ["ro-RO.json", "en-GB.json"]) {
      const ra = JSON.parse(read("messages", f)).dashboard.recentActivity;
      for (const k of ["typeNatural", "typeJudicial", "typeProperty", "typeDocument"]) expect([f, k, typeof ra[k]]).toEqual([f, k, "string"]);
    }
  });

  it("the kinds' words, in both languages", () => {
    for (const [f, nat, jud] of [["ro-RO.json", "Persoană fizică", "Persoană juridică"], ["en-GB.json", "Natural person", "Juridical person"]]) {
      const ra = JSON.parse(read("messages", f)).dashboard.recentActivity;
      expect([ra.typeNatural, ra.typeJudicial, ra.typePerson]).toEqual([nat, jud, undefined]);
    }
  });
});
