/**
 * Slice #37.70 — each kind of „Previzualizare" as Adrian asked:
 *   - a Natural Person: „născut:" („născută:" for a woman) before the date of birth;
 *   - a Judicial Person: how many contact persons it has, in parentheses, after its name;
 *   - a Property: Nr. parcelă, Tarla/Solă, Suprafață; then Poreclă; then Carte funciară, Nr. cadastral;
 *   - a Document: no „Tip document", the short label only as the heading, then
 *     Subiect, Nr. document and Data on one row.
 * The same body draws a preview on a detail screen and beside a list, so both change together.
 */
import { render, screen } from "@testing-library/react";
import { PreviewTileBody, compactLines } from "@/components/tiles/preview-tile-body";
import { loadPreview } from "@/components/tiles/preview-data";
import {
  DOCUMENT, PREVIEW_FIELDS, PREVIEW_INNER_REM, PREVIEW_ROWS, PREVIEW_SUBJECT_REM, PREVIEW_UNITS, PREVIEW_WIDTHS, boxRem, rowRem,
} from "@/lib/ui/field-widths";
import ro from "../../messages/ro-RO.json";
import en from "../../messages/en-GB.json";

const LABELS = { open: "Deschide", close: "Închide", readonly: "Numai citire", firstPage: "Prima pagină", noPage: "Nicio pagină" };

function stubFetch(routes: Record<string, unknown>) {
  global.fetch = jest.fn(async (url: string) => {
    const key = Object.keys(routes).find((k) => url === k);
    return key
      ? { ok: true, status: 200, json: async () => routes[key] }
      : { ok: false, status: 404, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe("loadPreview reads each kind's short set (Slice #37.70)", () => {
  it("a person: the four values and the gender", async () => {
    stubFetch({ "/api/people/p1": { person: { displayName: "x" }, natural: { lastName: "Pop", firstName: "Ana", nickname: "Ani", cnp: null, dateOfBirth: "1960-03-12", placeOfBirth: "Bragadiru", gender: "FEMALE" } } });
    const d = await loadPreview({ kind: "person", id: "p1" });
    expect(d.title).toBe("Pop Ana");
    expect(d.fields).toEqual({ nickname: "Ani", cnp: null, dateOfBirth: "12.03.1960", placeOfBirth: "Bragadiru" });
    expect(d.gender).toBe("FEMALE");
  });

  it.each([[null, null, 0], ["c1", null, 1], [null, "c2", 1], ["c1", "c2", 2]])(
    "a company with slots %s / %s counts %i contact persons",
    async (one, two, count) => {
      stubFetch({ "/api/judicial-persons/j1": { person: {}, judicial: { name: "Firma SRL", contactPerson1Id: one, contactPerson2Id: two }, judicialPersonTypeName: null } });
      expect((await loadPreview({ kind: "company", id: "j1" })).contacts).toBe(count);
    },
  );

  it("a property: its six values, Tarla/Solă as the tarla's indicativ", async () => {
    stubFetch({
      "/api/properties/r1": { property: { nickname: "Teren", parcela: "77/1", tarlaId: "t9", surfaceAreaMp: "1234", carteFunciara: "5001", cadastralNumber: "C-1" } },
      "/api/admin/value-lists/tarla": { items: [{ id: "t8", indicativ: "T8" }, { id: "t9", indicativ: "T9/2" }] },
    });
    const d = await loadPreview({ kind: "property", id: "r1" });
    expect(d.fields).toEqual({ parcela: "77/1", tarlaId: "T9/2", surfaceAreaMp: "1234", nickname: "Teren", carteFunciara: "5001", cadastralNumber: "C-1" });
  });

  it("a document: no „Tip document”, no „Etichetă scurtă” under the heading — Subiect, Nr. document, Data", async () => {
    stubFetch({
      "/api/documents/d1": { title: "Adeverință", documentTypeId: "ty", subject: "Rol fiscal", nrDocument: "12/2020", dateDocument: "2020-05-04" },
      "/api/documents/d1/pages": [],
    });
    const d = await loadPreview({ kind: "document", id: "d1" });
    expect(d.title).toBe("Adeverință");
    expect(d.fields).toEqual({ subject: "Rol fiscal", nrDocument: "12/2020", dateDocument: "04.05.2020" });
    expect(PREVIEW_FIELDS.document).not.toContain("documentTypeId");
    expect(PREVIEW_FIELDS.document).not.toContain("title");
  });
});

describe("the body draws them (Slice #37.70)", () => {
  function renderPerson(dateOfBirth: string | null) {
    return render(
      <PreviewTileBody
        title="Pop Ana"
        fields={[]}
        lines={[
          [{ label: "Poreclă", value: "Ani" }, { label: "CNP", value: null }],
          [{ label: "Data nașterii", value: dateOfBirth, prefix: "născută:" }, { label: "Locul nașterii", value: "Bragadiru" }],
        ]}
        openHref="/natural-persons/p1"
        labels={LABELS}
        onClose={() => {}}
        width="panel"
      />,
    );
  }

  it("„născut:” printed before the date, not a label on hover", () => {
    const { container } = renderPerson("12.03.1960");
    const lines = [...container.querySelectorAll("[data-preview-line]")].map((l) =>
      [...l.querySelectorAll("[data-preview-value]")].map((v) => [...v.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("")).join(""));
    expect(lines).toEqual(["Ani", "născută: 12.03.1960, Bragadiru"]);
  });

  it("with no date, neither the word nor the date", () => {
    const { container } = renderPerson(null);
    expect(container.textContent).not.toContain("născut");
    expect(compactLines([[{ label: "Data nașterii", value: null, prefix: "născut:" }]])).toEqual([]);
  });

  it("a company's count stands after its name, outside the heading", () => {
    render(
      <PreviewTileBody title="Firma SRL" titleNote="(2 contacte)" fields={[]} lines={[[{ label: "Poreclă", value: "Firma" }]]} openHref="/judicial-persons/j1" labels={LABELS} onClose={() => {}} width="panel" />,
    );
    expect(screen.getByRole("heading", { name: "Firma SRL" })).toBeTruthy();
    const note = document.querySelector("[data-preview-title-note]") as HTMLElement;
    expect(note.textContent).toBe("(2 contacte)");
    expect(note.className).toMatch(/text-fade/);
    expect(screen.getByRole("heading", { name: "Firma SRL" }).nextElementSibling).toBe(note);
  });

  it("a long name wraps inside the heading's row; „Numai citire” and the buttons stay at its right", () => {
    render(
      <PreviewTileBody title={"Adeverință ".repeat(12)} fields={[]} openHref="/documents/d1" labels={LABELS} onClose={() => {}} width="pages" />,
    );
    const head = document.querySelector("[data-preview-head]") as HTMLElement;
    expect(head.className).not.toMatch(/flex-wrap/);
    expect(head.firstElementChild!.className).toMatch(/min-w-0 flex-1/);
    expect(head.children[1].textContent).toBe("Numai citire");
    expect(head.children[1].className).toMatch(/shrink-0/);
    expect(head.lastElementChild!.className).toMatch(/shrink-0/);
  });
});

describe("the messages and the rows (Slice #37.70)", () => {
  it("„născut:” / „născută:” and the plural count, Romanian first", () => {
    expect([ro.shared.preview.bornMale, ro.shared.preview.bornFemale]).toEqual(["născut:", "născută:"]);
    expect(en.shared.preview.bornMale).toBe("born:");
    expect(ro.shared.preview.contacts).toBe("{count, plural, =0 {(niciun contact)} one {(1 contact)} other {(# contacte)}}");
    expect(en.shared.preview.contacts).toBe("{count, plural, =0 {(no contacts)} one {(1 contact)} other {(# contacts)}}");
    expect(ro.shared.preview.fields.tarla).toBe("Tarla/Solă");
    // „Tip document" is no longer asked for by the previews (its key stays for nobody).
  });

  it("the property's three rows, in order, in the 3-unit tile", () => {
    expect(PREVIEW_ROWS.property).toEqual([["parcela", "tarlaId", "surfaceAreaMp"], ["nickname"], ["carteFunciara", "cadastralNumber"]]);
    expect(PREVIEW_UNITS.panel).toBe(3);
    expect(rowRem(PREVIEW_ROWS.property[0].map((f) => PREVIEW_WIDTHS.property[f]))).toBe(26.5);
    expect(26.5).toBeLessThanOrEqual(PREVIEW_INNER_REM.panel);
  });

  it("the document's one row fills its tile: Subiect takes what Nr. document and Data leave", () => {
    expect(PREVIEW_ROWS.document).toEqual([["subject", "nrDocument", "dateDocument"]]);
    expect(PREVIEW_SUBJECT_REM).toBe(PREVIEW_INNER_REM.pages - boxRem(DOCUMENT.nrDocument) - boxRem(DOCUMENT.dateDocument) - 1);
    expect(boxRem(PREVIEW_WIDTHS.document.subject)).toBe(PREVIEW_SUBJECT_REM);
    expect(rowRem(PREVIEW_ROWS.document[0].map((f) => PREVIEW_WIDTHS.document[f]))).toBeCloseTo(PREVIEW_INNER_REM.pages, 6);
  });
});
