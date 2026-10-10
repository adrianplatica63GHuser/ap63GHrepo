/**
 * #38.53 — document types: no „Cheie" column; the key in the name's tooltip.
 *
 * Adrian: „remove the key column from the same table (document types) and
 * only display the key (as a tip) if the user hovers over the name column".
 * Ask first 1, as recommended: ONE tooltip — the full name, and the key under
 * it in a monospace face. The add form still asks for the key (`createOnly`).
 */
import fs from "node:fs";
import path from "node:path";
import { createEvent, fireEvent, render } from "@testing-library/react";

import { LIST_META, VALID_LIST_KEYS } from "@/lib/admin/value-lists/config";
import { IconTooltip } from "@/lib/ui/icon-button";

const MODAL = fs.readFileSync(
  path.join(process.cwd(), "src/app/admin/value-lists/_components/value-list-modal.tsx"),
  "utf8",
);

describe("the key is not a column (#38.53)", () => {
  // #38.53: „the one `nameTip` field on any list" — `toEqual(["document-types.key"])`. #38.70 reads the roles'
  // description in their name's tooltip too, so the roles' table fits 1366 px; the key is still create-only.
  it("is one of two `nameTip` fields: the document type's key, still create-only, and the roles' description", () => {
    const tips = VALID_LIST_KEYS.flatMap((list) => LIST_META[list].fields.filter((f) => f.nameTip).map((f) => `${list}.${f.key}`));
    expect(tips).toEqual(["person-roles.description", "document-types.key"]);
    expect(LIST_META["document-types"].fields.find((f) => f.key === "key")).toMatchObject({ createOnly: true, nameTip: true });
  });

  it("is left out of the table's cells, and so out of its columns", () => {
    expect(MODAL).toContain("if (f.nameTip) continue;");
    expect(MODAL).toContain("...listCells(listKey).map((cell) => cellColumn(cell, listKey)),");
  });

  it("is read in the name's ONE tooltip — the name, the key under it in mono — and the name cell has no `title` of its own", () => {
    // #38.53 pinned `noteMono` bare: the key was the only `nameTip`. #38.70 reads the roles' description there too, in
    // the body's face — mono is for a key.
    expect(MODAL).toContain('<IconTooltip label={cellText(cell, row)} note={String(row[nameTip.key] ?? "").trim() || "–"} noteMono={nameTip.key === "key"} className="max-w-full">');
    expect(MODAL).toContain('title={nameTip && cell[0].key === "name" ? undefined : cellText(cell, row)}');
  });
});

describe("IconTooltip's `noteMono` (#38.53)", () => {
  function hover(el: Element) {
    const ev = createEvent.pointerOver(el);
    Object.defineProperty(ev, "pointerType", { value: "mouse" });
    fireEvent(el, ev);
  }

  it("puts the note in a monospace face under the label", () => {
    const { container } = render(
      <IconTooltip label="Contract de Vânzare" note="CONTRACT_VANZARE" noteMono>
        <span>Contract de Vânzare</span>
      </IconTooltip>,
    );
    hover(container.firstElementChild as Element);
    const tip = document.querySelector('[role="tooltip"]');
    expect(tip).toHaveTextContent("Contract de VânzareCONTRACT_VANZARE");
    const note = tip?.querySelector("span");
    expect(note?.textContent).toBe("CONTRACT_VANZARE");
    expect(note?.className.split(" ")).toContain("font-mono");
  });

  it("leaves a note without it as it was", () => {
    const { container } = render(
      <IconTooltip label="Modifică" note="Doar versiunea curentă">
        <span>x</span>
      </IconTooltip>,
    );
    hover(container.firstElementChild as Element);
    expect(document.querySelector('[role="tooltip"] span')?.className.split(" ")).not.toContain("font-mono");
  });
});
