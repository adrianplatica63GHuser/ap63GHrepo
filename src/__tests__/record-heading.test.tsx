/**
 * RecordHeading — the record's icon before its name.             (Slice #37.49)
 *
 * What the header asks of it: the icon is hidden from assistive technology, so
 * the <h1>'s accessible name is the record's name alone; the icon is sized in
 * em from the heading's own font and the gap is a margin, not characters in
 * the name; a long name truncates while the icon never shrinks. And the four
 * detail screens draw their heading through it, each with the icon the app
 * already uses for that kind of record.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";
import { FileText, User } from "lucide-react";

import { RecordHeading } from "@/lib/ui/record-heading";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

describe("RecordHeading (#37.49)", () => {
  it("names the heading with the record's name alone — the icon is aria-hidden", () => {
    render(<RecordHeading icon={User} name="Ion Popescu" />);
    const h = screen.getByRole("heading", { level: 1, name: "Ion Popescu" });
    expect(h).toHaveTextContent(/^Ion Popescu$/);
    const svg = h.querySelector("svg")!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("class")).toContain("lucide-user");
  });

  it("puts the icon first, 1em square from the heading's font, the gap a 0.55em margin", () => {
    render(<RecordHeading icon={User} name="Ion Popescu" />);
    const h = screen.getByRole("heading", { level: 1 });
    expect(h.className).toMatch(/(?<![\w-])text-2xl(?![\w-])/);
    const [first, second] = Array.from(h.children);
    expect(first.tagName.toLowerCase()).toBe("svg");
    const cls = first.getAttribute("class") ?? "";
    for (const c of ["h-[1em]", "w-[1em]", "mr-[0.55em]", "shrink-0"]) expect(cls.split(" ")).toContain(c);
    // The gap is not characters inside the name.
    expect(second.textContent).toBe("Ion Popescu");
  });

  it("truncates a long name in its own span, and passes the title through", () => {
    const long = "Contract de vânzare-cumpărare ".repeat(8).trim();
    render(<RecordHeading icon={FileText} name={long} truncate className="min-w-[8rem]" title={long} />);
    const h = screen.getByRole("heading", { level: 1, name: long });
    expect(h.getAttribute("title")).toBe(long);
    expect(h.className.split(" ")).toEqual(expect.arrayContaining(["flex", "min-w-0", "items-center", "min-w-[8rem]"]));
    expect(h.className.split(" ")).not.toContain("truncate");
    const span = h.querySelector("span")!;
    expect(span.className.split(" ")).toEqual(expect.arrayContaining(["min-w-0", "truncate"]));
  });

  it("does not truncate unless asked", () => {
    render(<RecordHeading icon={User} name="Ion Popescu" />);
    expect(screen.getByRole("heading", { level: 1 }).querySelector("span")!.className.split(" ")).not.toContain("truncate");
  });

  it.each([
    ["natural-persons/_components/person-detail-tiles.tsx", /<RecordHeading icon=\{User\} name=\{personName\} \/>/],
    ["judicial-persons/_components/person-detail-tiles.tsx", /<RecordHeading icon=\{Building2\} name=\{personName\} \/>/],
    ["properties/_components/property-detail-tiles.tsx", /<RecordHeading icon=\{MapIcon\} name=\{propertyName\} \/>/],
    ["documents/_components/document-detail-tiles.tsx", /<RecordHeading\s+icon=\{FileText\}\s+name=\{documentName\}\s+truncate\b/],
  ])("%s draws its heading through RecordHeading, with its icon", (file, pattern) => {
    const src = read("src", "app", ...file.split("/"));
    expect(src).toMatch(pattern);
    expect(src).not.toMatch(/<h1\b/);
  });

  it("the Property's icon is the folded map, not the list", () => {
    expect(read("src", "app", "properties", "_components", "property-detail-tiles.tsx")).toMatch(
      /import \{ Map as MapIcon \} from "lucide-react";/,
    );
  });
});
