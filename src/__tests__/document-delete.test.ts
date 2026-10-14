/**
 * Slice #39.32 — „Șterge" on a document left a grey rectangle and no buttons,
 * and the document stayed.
 *
 * The cause: the tile row's packer (`use-tile-packing.ts`) took the
 * confirmation's overlay — mounted beside the tiles, `fixed inset-0` — for a
 * tile, placed it `position: absolute` in a column, and the row and the overlay
 * then grew each other to millions of pixels; the dialog's „Da", centred in
 * it, left the screen, so no DELETE was ever sent. An overlay is not a box.
 *
 * And a delete that does fail now says why in Romanian, from the status —
 * never the route's English `error`.
 */
import fs from "node:fs";
import path from "node:path";

import { findBoxes, isOverlay } from "@/components/tiles/use-tile-packing";
import { deleteFailureKey, deleteFailureMessage } from "@/lib/documents/delete-failure";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const messages = (locale: "ro-RO" | "en-GB") =>
  JSON.parse(read("messages", `${locale}.json`)) as { document: Record<string, unknown> };

function row(): HTMLElement {
  // The Document's shape: a `display: contents` form holding its tiles and,
  // when „Șterge" is pressed, the confirmation's overlay beside them.
  document.body.innerHTML = `
    <div id="row">
      <div id="form" style="display: contents">
        <section id="ident" data-tile="ident">Identificarea actului</section>
        <div id="overlay" role="dialog" style="position: fixed; inset: 0">Ștergeți actul?</div>
      </div>
      <section id="links" data-tile="links">Legături</section>
    </div>`;
  return document.getElementById("row") as HTMLElement;
}

describe("the confirmation's overlay is not a tile (#39.32)", () => {
  it("is recognised by its fixed position", () => {
    row();
    expect(isOverlay(document.getElementById("overlay") as HTMLElement)).toBe(true);
    expect(isOverlay(document.getElementById("ident") as HTMLElement)).toBe(false);
  });

  it("the row's boxes are the tiles, walking through the form, and never the overlay", () => {
    const boxes = findBoxes(row());
    expect(boxes.map((b) => b.el.id)).toEqual(["ident", "links"]);
    expect(boxes.map((b) => b.id)).toEqual(["ident", "links"]);
  });
});

describe("a failed delete says why, in the screen's language (#39.32)", () => {
  const t = (key: string) => `«${key}»`;

  it("404 is „no longer in the archive”; anything else the general sentence with its status", () => {
    expect(deleteFailureKey(404)).toBe("deleteNotFound");
    expect(deleteFailureKey(500)).toBe("deleteError");
    expect(deleteFailureKey(null)).toBe("deleteError");
    expect(deleteFailureMessage(404, t)).toBe("«deleteNotFound»");
    expect(deleteFailureMessage(500, t)).toBe("«deleteError» (HTTP 500)");
    expect(deleteFailureMessage(null, t)).toBe("«deleteError»");
  });

  it.each(["ro-RO", "en-GB"] as const)("%s carries both sentences in `document`", (locale) => {
    const d = messages(locale).document;
    for (const key of ["deleteNotFound", "deleteError", "saveErrorSession"]) {
      expect(typeof d[key]).toBe("string");
      expect((d[key] as string).trim()).not.toBe("");
    }
  });

  it("the Romanian sentence is Romanian", () => {
    expect(messages("ro-RO").document.deleteNotFound).toBe("Actul nu mai există în arhivă — poate a fost șters între timp.");
  });

  it("the form's delete never shows the route's own `error`, and treats a redirect as a lost session", () => {
    const form = read("src", "app", "documents", "_components", "document-form.tsx");
    const start = form.indexOf("const onDelete = async () => {");
    const body = form.slice(start, form.indexOf("\n  };", start));
    expect(start).toBeGreaterThan(-1);
    expect(body).not.toMatch(/body\?\.error|\.error\b.*\?\?/);
    expect(body).toContain("deleteFailureMessage(res.status, t)");
    expect(body).toMatch(/if \(res\.redirected\) throw new Error\(t\("saveErrorSession"\)\)/);
    // The failure path keeps the screen usable: the dialog closes, the buttons come back.
    expect(body).toMatch(/catch \(err\) \{[\s\S]*setSubmitting\(false\);[\s\S]*setConfirmDelete\(false\);/);
  });
});
