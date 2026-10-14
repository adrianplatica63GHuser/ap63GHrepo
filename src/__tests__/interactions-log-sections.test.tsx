/**
 * Slice #39.33 — „Înregistrează o interacțiune" in five sections that open and close.
 *
 * The section (WAI-ARIA accordion: a button in a heading, aria-expanded, aria-controls, the panel a region that
 * stays mounted when closed), which sections are open when the tile opens, what a closed one says, and that an
 * error in a closed section opens it.
 */
import fs from "node:fs";
import path from "node:path";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { DisclosureSection } from "@/lib/ui/disclosure-section";
import { FORM_FIELDS, emptyForm, type LogForm } from "@/lib/interactions/form";
import { LOG_SECTIONS, SECTION_OF_FIELD, errorIn, holds, initialOpen, relatedCounts } from "@/lib/interactions/log-sections";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const messages = (locale: "ro-RO" | "en-GB") =>
  JSON.parse(read("messages", `${locale}.json`)) as { interactions: { log: Record<string, unknown> } };

function One({ summary, error }: { summary?: string; error?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <DisclosureSection id="s" title="Asocieri" open={open} onToggle={() => setOpen((o) => !o)} summary={summary} error={error}>
      <label>
        Etichetă <input />
      </label>
    </DisclosureSection>
  );
}

describe("the section (#39.33)", () => {
  it("is a button in a heading, closed: aria-expanded false, its panel hidden but mounted", () => {
    render(<One />);
    const button = screen.getByRole("button", { name: "Asocieri" });
    expect(button.closest("h3")).not.toBeNull();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", "s-panel");
    const panel = document.getElementById("s-panel") as HTMLElement;
    expect(panel).toHaveAttribute("hidden");
    expect(panel).toHaveAttribute("role", "region");
    expect(panel.querySelector("input")).not.toBeNull();
    // The arrow is decoration: hidden from a screen reader, turned only when open.
    const svg = button.querySelector("svg") as SVGElement;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.getAttribute("class")).not.toContain("rotate-90");
  });

  it("a click opens it — the arrow turns down, the content shows — and a second closes it", () => {
    render(<One />);
    const button = screen.getByRole("button", { name: "Asocieri" });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("s-panel")).not.toHaveAttribute("hidden");
    expect(screen.getByRole("region", { name: "Asocieri" })).toBeInTheDocument();
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("rotate-90");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("s-panel")).toHaveAttribute("hidden");
  });

  it("closed, it says what it holds; an error it holds wins, in red; open, neither", () => {
    const { unmount } = render(<One summary="2 acte" />);
    expect(screen.getByRole("button", { name: "Asocieri · 2 acte" })).toBeInTheDocument();
    unmount();
    render(<One summary="2 acte" error="Alege data mementoului." />);
    const button = screen.getByRole("button", { name: "Asocieri · Alege data mementoului." });
    expect(button.querySelector("[data-disclosure-note]")).toHaveAttribute("data-disclosure-note", "error");
    fireEvent.click(button);
    expect(button.querySelector("[data-disclosure-note]")).toBeNull();
  });
});

const filled = (patch: Partial<LogForm>): LogForm => ({ ...emptyForm("p"), ...patch });

describe("which sections are open, and what they hold (#39.33, Ask first 1 and 2)", () => {
  it("the five, in Adrian's order", () => {
    expect(LOG_SECTIONS).toEqual(["connections", "manual", "related", "followUp", "internal"]);
  });

  it("a new record: only „Înregistrare manuală”", () => {
    expect([...initialOpen(emptyForm(null), "new")]).toEqual(["manual"]);
    // „Salvează și adaugă" keeps values; a new record still starts from the defaults.
    expect([...initialOpen(filled({ tags: ["x"], followUp: true }), "new")]).toEqual(["manual"]);
  });

  it("edit mode: every section that holds a value opens as well", () => {
    const form = filled({ subject: "S", tags: ["contract"], followUp: true, followUpOn: "2026-10-21", internal: true });
    expect([...initialOpen(form, "edit")].sort()).toEqual(["followUp", "internal", "manual", "related"]);
    expect([...initialOpen(filled({ subject: "S" }), "edit")]).toEqual(["manual"]);
  });

  it("„Asocieri” holds documents, tags or a property; „Conturi conectate” never holds anything", () => {
    expect(holds(filled({ documents: [{ id: "d", title: null }] }), "related")).toBe(true);
    expect(holds(filled({ property: { id: "p", label: null } }), "related")).toBe(true);
    expect(holds(emptyForm(null), "related")).toBe(false);
    expect(holds(filled({ subject: "x" }), "connections")).toBe(false);
    expect(relatedCounts(filled({ documents: [{ id: "a", title: null }, { id: "b", title: null }], tags: ["t"] }))).toEqual({ documents: 2, tags: 1, property: 0 });
  });
});

describe("an error in a closed section (#39.33, Ask first 3)", () => {
  it("every field that can be in error has its section", () => {
    for (const f of FORM_FIELDS) expect(LOG_SECTIONS).toContain(SECTION_OF_FIELD[f]);
    expect(SECTION_OF_FIELD.followUpOn).toBe("followUp");
    expect(SECTION_OF_FIELD.subject).toBe("manual");
  });

  it("is found in its section, and only there", () => {
    expect(errorIn("followUp", { followUpOn: "followUpRequired" }, FORM_FIELDS)).toBe("followUpRequired");
    expect(errorIn("manual", { followUpOn: "followUpRequired" }, FORM_FIELDS)).toBeNull();
    expect(errorIn("manual", { subject: "subjectRequired", when: "whenRequired" }, FORM_FIELDS)).toBe("subjectRequired");
  });

  it("the save opens the section of the first error and focuses its field once drawn", () => {
    const tile = read("src", "app", "interactions", "_components", "log-tile.tsx");
    const block = tile.slice(tile.indexOf("if (!result.ok) {"), tile.indexOf("if (mode === \"edit\" && (!loaded || !readAt)) return false;"));
    expect(block).toContain("const section = SECTION_OF_FIELD[first];");
    expect(block).toMatch(/setOpen\(\(prev\) => \(prev\.has\(section\) \? prev : new Set\(prev\)\.add\(section\)\)\)/);
    expect(block).toContain("focusSoon(FIELD_ID[first]);");
  });
});

describe("the tile (#39.33)", () => {
  const tile = read("src", "app", "interactions", "_components", "log-tile.tsx");

  it("draws the five sections in order, the mode switch before them and the buttons after", () => {
    const at = (s: string) => tile.indexOf(s);
    const order = ["connections", "manual", "related", "followUp", "internal"].map((s) => at(`sectionProps("${s}", tl("${s}"))`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(at('role="radiogroup" aria-label={tl("mode")}')).toBeLessThan(order[0]);
    expect(at("{/* The action bar (§4). */}")).toBeGreaterThan(order[4]);
  });

  it.each(["ro-RO", "en-GB"] as const)("%s names the five and the summaries", (locale) => {
    const log = messages(locale).interactions.log as Record<string, unknown> & { summary: Record<string, string> };
    for (const k of ["connections", "manual", "related", "followUp", "internal"]) expect(typeof log[k]).toBe("string");
    for (const k of ["documents", "tags", "property", "followUpNoDate", "internalOn"]) expect(log.summary[k].trim()).not.toBe("");
  });

  it("„Related” is „Asocieri” — not „Legături”, the tile beside the lists (Ask first 4)", () => {
    expect(messages("ro-RO").interactions.log.related).toBe("Asocieri");
    expect(messages("en-GB").interactions.log.related).toBe("Related");
  });
});
