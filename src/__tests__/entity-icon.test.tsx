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
import { ENTITY_COLOUR_CLASS, ENTITY_COLOUR_VAR, ENTITY_ICON, ENTITY_ICON_PLAIN, type EntityKind } from "@/lib/ui/entity-icon";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("one mark for each kind (40.61)", () => {
  it("the four marks, defined once", () => {
    // 41.47: the four shapes are ENTITY_ICON_PLAIN; ENTITY_ICON draws each in its kind's colour (it read
    // `expect(ENTITY_ICON).toEqual({ natural: User, … })`).
    expect(ENTITY_ICON_PLAIN).toEqual({ natural: User, judicial: Building2, property: MapIcon, document: FileText });
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
    // 41.46: it read `toHaveAttribute("title", …)` — the name is in the icon buttons' bubble now, from `data-hint`.
    expect(mark).not.toHaveAttribute("title");
    expect(mark).toHaveAttribute("data-hint", "Persoană juridică");
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
    // 41.01: one card for both count tiles (KindCountCard); the recent tile's is the plain one.
    const counts = dash.slice(dash.indexOf("function KindCountCard"), dash.indexOf("export function RecentCountsSection"));
    // 40.76: the same look through the role tokens — ink, a raised card with the wire border — which carry their dark.
    expect(counts).toContain('className="text-xl font-bold leading-7 tabular-nums"');
    expect(counts).toContain('"border-wire bg-raised text-ink"');
    // 41.47: a warning card's mark stays amber — the plain one (it read `const Icon = ENTITY_ICON[kind];`).
    expect(counts).toContain('const Icon = tone === "warning" ? ENTITY_ICON_PLAIN[kind] : ENTITY_ICON[kind];');
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

describe("the four kinds' icons in their own colours (41.47)", () => {
  const KINDS: EntityKind[] = ["natural", "judicial", "property", "document"];
  const css = read("src", "app", "globals.css");
  const block = (start: string) => css.slice(css.indexOf(start), css.indexOf("}", css.indexOf(start)));

  it("Adrian's four values in light, lighter values of the same hues in dark", () => {
    const light = block("@theme {");
    const dark = block(".dark {");
    expect(light).toMatch(/--color-kind-natural:\s+#5A2781;/);
    expect(light).toMatch(/--color-kind-judicial:\s+#123456;/);
    expect(light).toMatch(/--color-kind-property:\s+#00A84C;/);
    expect(light).toMatch(/--color-kind-document:\s+#008AF2;/);
    for (const k of KINDS) expect(dark).toMatch(new RegExp(`--color-kind-${k}:\\s+#[0-9A-F]{6};`));
  });

  it("every dark value reaches 3:1 on the dark card #18181b", () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const dark = block(".dark {");
    for (const k of KINDS) {
      const hex = new RegExp(`--color-kind-${k}:\\s+(#[0-9A-F]{6});`).exec(dark)![1];
      expect([k, ratio(hex, "#18181b") >= 3]).toEqual([k, true]);
    }
  });

  it.each(KINDS)("%s: the icon draws its line in the kind's colour, whatever class the call site gives it", (kind) => {
    const Icon = ENTITY_ICON[kind];
    const { container } = render(<Icon size={16} aria-hidden="true" className="text-fade" style={{ marginTop: 1 }} />);
    const svg = container.querySelector("svg")!;
    expect(svg.style.color).toBe(ENTITY_COLOUR_VAR[kind]);
    expect(svg.style.marginTop).toBe("1px");
    expect(svg.getAttribute("data-kind-icon")).toBe(kind);
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(ENTITY_COLOUR_CLASS[kind]).toBe(`text-kind-${kind}`);
  });

  it("the plain four are drawn only where a card must stay amber; „Recente” and the surveyor picker draw the coloured four", () => {
    const users = ["src/app/_components/dashboard-client.tsx"];
    const all = read("src", "lib", "ui", "entity-icon.ts");
    expect(all).toContain("export const ENTITY_ICON_PLAIN");
    const recent = code(read("src", "components", "recently-viewed-panel.tsx"));
    expect(recent).toContain("const Icon = ENTITY_ICON[KIND[type]];");
    expect(recent).not.toMatch(/\b(User|Building2|List|FileText)\b/);
    const form = code(read("src", "app", "documents", "_components", "document-form.tsx"));
    expect(form).toContain("icon={ENTITY_ICON.natural}");
    expect(form).toContain("icon={ENTITY_ICON.judicial}");
    expect(form).not.toMatch(/icon=\{(User|Building2)\}/);
    for (const f of users) expect(read(...f.split("/"))).toContain("ENTITY_ICON_PLAIN[kind]");
  });

  it("the lists' plural title icons draw in their kind's colour too", () => {
    const icons = read("src", "components", "icons", "list-icons.tsx");
    for (const [name, kind] of [["people-group", "natural"], ["buildings", "judicial"], ["map-pins", "property"], ["pages", "document"]]) {
      expect(icons).toContain(`name="${name}" {...props} data-kind-icon="${kind}" style={{ ...props.style, color: ENTITY_COLOUR_VAR.${kind} }}`);
    }
  });
});
