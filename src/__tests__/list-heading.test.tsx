/**
 * ListHeading and the lists' many-records icons.                                                   (Slice 40.38)
 *
 * Adrian, 2026-10-23: an icon of several records before each principal list's title, drawn after Big.Icons.docx,
 * about 25 % bigger than a record screen's icon and spaced as it is. So: the icon first, aria-hidden (the heading's
 * name stays the title), 1.25em square, the record screen's 0.55em gap; the four list pages draw it with their own
 * icon; the icons are hand-drawn in Lucide's shape — 24-unit box, currentColor stroke 2, round, no fill.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";

import { BuildingsIcon, MapPinsIcon, PagesIcon, PeopleGroupIcon } from "@/components/icons/list-icons";
import { ListHeading, RecordHeading } from "@/lib/ui/record-heading";
import { User } from "lucide-react";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

describe("ListHeading (40.38)", () => {
  it("41.92: under Administrare, the same heading in the red, its icon in the heading's colour", () => {
    render(<ListHeading icon={User} title="Grupuri" admin className="mb-2" />);
    const h = screen.getByRole("heading", { level: 1, name: "Grupuri" });
    for (const c of ["text-2xl", "font-semibold", "tracking-tight", "text-admin-title", "mb-2"]) expect(h.className.split(" ")).toContain(c);
    expect(h.getAttribute("data-list-heading")).toBe("admin");
    expect(h.firstElementChild!.hasAttribute("data-list-icon")).toBe(true);
  });

  it("41.92: the five Administrare screens take it with the side panel's own icon", () => {
    for (const [file, key] of [
      [["src", "app", "admin", "value-lists", "_components", "value-list-hub.tsx"], "referenceData"],
      [["src", "app", "admin", "groups", "page.tsx"], "groups"],
      [["src", "app", "admin", "stamps", "page.tsx"], "stamps"],
      [["src", "app", "admin", "tags", "page.tsx"], "tags"],
      [["src", "app", "admin", "settings", "page.tsx"], "settings"],
    ] as const) {
      expect([file.join("/"), read(...file).includes(`<ListHeading icon={adminIcon("${key}")} title={t("pageTitle")} admin`)]).toEqual([file.join("/"), true]);
    }
    // 42.01 (FU-394): „Utilizatori & Acces", a group's and a stamp's screen, and a document type's page too.
    expect(read("src", "app", "admin", "users", "page.tsx").split('<ListHeading icon={adminIcon("users")} title={t("title")} admin').length - 1).toBe(2);
    expect(read("src", "app", "admin", "groups", "[id]", "page.tsx")).toContain('<ListHeading icon={adminIcon("groups")} title={t("editorTitle", { code: detail.code })} admin />');
    expect(read("src", "app", "admin", "stamps", "[id]", "page.tsx")).toContain('<ListHeading icon={adminIcon("stamps")} title={t("applicator.pageTitle", { stamp: title })} admin />');
    expect(read("src", "app", "admin", "value-lists", "_components", "document-type-page.tsx")).toContain('<ListHeading icon={adminIcon("referenceData")} title={name} admin />');
    const nav = read("src", "components", "sidebar", "nav-config.ts");
    expect(nav).toMatch(/\{ key: "referenceData", href: "\/admin\/value-lists", icon: BookOpen \}/);
    expect(nav).toContain('NAV_SECTIONS.find((s) => s.key === "administration")');
  });

  it("names the heading with the title alone — the icon is aria-hidden and comes first", () => {
    render(<ListHeading icon={PeopleGroupIcon} title="Persoane fizice" />);
    const h = screen.getByRole("heading", { level: 1, name: "Persoane fizice" });
    expect(h).toHaveTextContent(/^Persoane fizice$/);
    const first = h.firstElementChild!;
    expect(first.tagName.toLowerCase()).toBe("svg");
    expect(first.getAttribute("aria-hidden")).toBe("true");
    expect(first.hasAttribute("data-list-icon")).toBe(true);
    expect(first.getAttribute("class")).toContain("lucide-people-group");
  });

  it("is the record heading's row, its icon 1.25em and the same 0.55em gap", () => {
    render(
      <>
        <ListHeading icon={PagesIcon} title="Acte" />
        <RecordHeading icon={User} name="Ion" />
      </>,
    );
    const [list, record] = screen.getAllByRole("heading", { level: 1 });
    for (const c of ["flex", "items-center", "text-2xl", "font-semibold", "tracking-tight"]) {
      expect(list.className.split(" ")).toContain(c);
      expect(record.className.split(" ")).toContain(c);
    }
    const cls = (list.firstElementChild!.getAttribute("class") ?? "").split(" ");
    for (const c of ["h-[1.25em]", "w-[1.25em]", "mr-[0.55em]", "shrink-0"]) expect(cls).toContain(c);
    expect((record.firstElementChild!.getAttribute("class") ?? "").split(" ")).toContain("mr-[0.55em]");
  });

  it.each([
    ["people-group", PeopleGroupIcon],
    ["buildings", BuildingsIcon],
    ["map-pins", MapPinsIcon],
    ["pages", PagesIcon],
  ] as const)("%s is drawn in Lucide's shape", (name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe("2");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
    expect(svg.getAttribute("class")).toContain(`lucide-${name}`);
    expect(svg.children.length).toBeGreaterThan(2);
  });

  it.each([
    ["natural-persons", "PeopleGroupIcon"],
    ["judicial-persons", "BuildingsIcon"],
    ["properties", "MapPinsIcon"],
    ["documents", "PagesIcon"],
  ])("%s's page draws its title through ListHeading with %s", (dir, icon) => {
    const page = read("src", "app", dir, "page.tsx");
    expect(page).toContain(`<ListHeading icon={${icon}} title={t("listTitle")} />`);
    expect(page).not.toMatch(/<h1[^>]*>\s*\{t\("listTitle"\)\}/);
  });
});
