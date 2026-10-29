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
import { firstFilled, loadPreview, oneLine } from "@/components/tiles/preview-data";
import { readFileSync } from "fs";
import { join } from "path";
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
  // #39.28: and the first filled phone and e-mail, and the notes on one line — it read the four values alone,
  // `{ nickname: "Ani", cnp: null, dateOfBirth: "12.03.1960", placeOfBirth: "Bragadiru" }`.
  it("a person: the values of the four lines and the gender", async () => {
    stubFetch({
      "/api/people/p1": {
        person: { displayName: "x", notes: "  Clientă veche.\n\nSună dimineața.  " },
        natural: {
          lastName: "Pop", firstName: "Ana", nickname: "Ani", cnp: null, dateOfBirth: "1960-03-12", placeOfBirth: "Bragadiru", gender: "FEMALE",
          personalPhone1: "", personalPhone2: "+40 700 000 001", workPhone: "+40 21 000 0000",
          personalEmail1: null, personalEmail2: null, workEmail: "ana@example.ro",
        },
      },
    });
    const d = await loadPreview({ kind: "person", id: "p1" });
    expect(d.title).toBe("Pop Ana");
    expect(d.fields).toEqual({
      nickname: "Ani", cnp: null, dateOfBirth: "12.03.1960", placeOfBirth: "Bragadiru", dateOfDeath: null,
      phone: "+40 700 000 001", email: "ana@example.ro", notes: "Clientă veche. Sună dimineața.",
    });
    expect(d.gender).toBe("FEMALE");
    expect(d.isDeceased).toBe(false);
  });

  it("a dead person: „decedat: <date>” on line 2, only for a person marked „Decedat” (#39.30)", async () => {
    stubFetch({
      "/api/people/p3": { person: { displayName: "Pop Ion", notes: null }, natural: { lastName: "Pop", firstName: "Ion", dateOfBirth: "1921-05-01", isDeceased: true, dateOfDeath: "1998-04-30" } },
      "/api/people/p4": { person: { displayName: "Pop Vasile", notes: null }, natural: { lastName: "Pop", firstName: "Vasile", isDeceased: false, dateOfDeath: null } },
    });
    const dead = await loadPreview({ kind: "person", id: "p3" });
    expect([dead.isDeceased, dead.fields.dateOfDeath]).toEqual([true, "30.04.1998"]);
    const alive = await loadPreview({ kind: "person", id: "p4" });
    expect([alive.isDeceased, alive.fields.dateOfDeath]).toEqual([false, null]);
    const tiles = readFileSync(join(process.cwd(), "src", "components", "tiles", "preview-tiles.tsx"), "utf8");
    expect(tiles).toMatch(/name === "dateOfDeath" && data\.isDeceased && !data\.fields\.dateOfDeath \? t\("deathDateUnknown"\)/);
    expect(tiles).toContain("${data.isDeceased ? ` ${DECEASED_MARK}` : \"\"}");
  });

  it("a person with every value missing: none", async () => {
    stubFetch({ "/api/people/p2": { person: { displayName: "Fără nimic", notes: "   " }, natural: { lastName: null, firstName: null } } });
    const d = await loadPreview({ kind: "person", id: "p2" });
    expect(d.title).toBe("Fără nimic");
    expect(Object.values(d.fields).every((v) => v === null)).toBe(true);
  });

  // #39.28 (Ask first #2): a company's preview no longer counts its contact persons — #37.70's
  // „a company with slots %s / %s counts %i contact persons" — nor shows its „Tip" or „Nr. Reg. Com.".
  it("a company: nickname, CUI, its phone, its e-mail and its notes — no type, no trade register, no count", async () => {
    stubFetch({
      "/api/judicial-persons/j1": {
        person: { notes: "Firmă de construcții." },
        judicial: { name: "Firma SRL", nickname: "Firma", cuiNumber: "RO1", tradeRegisterNumber: "J1/1/2020", phone: "021 000", email: "f@example.ro", contactPerson1Id: "c1", contactPerson2Id: "c2" },
        judicialPersonTypeName: "SRL",
      },
    });
    const d = await loadPreview({ kind: "company", id: "j1" });
    expect(d.fields).toEqual({ nickname: "Firma", cuiNumber: "RO1", phone: "021 000", email: "f@example.ro", notes: "Firmă de construcții." });
    expect(d).not.toHaveProperty("contacts");
  });

  it("the first filled of several, in the form's order; notes on one line", () => {
    expect(firstFilled(null, "", "  ", "b", "c")).toBe("b");
    expect(firstFilled(null, undefined)).toBeNull();
    expect(oneLine("a\n\n  b\tc ")).toBe("a b c");
    expect(oneLine(" \n ")).toBeNull();
  });

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
    // #39.28: the count is gone (it held „{count, plural, =0 {(niciun contact)} …}"); „CNP:" and „CUI:" came.
    expect(ro.shared.preview).not.toHaveProperty("contacts");
    expect([ro.shared.preview.cnpPrefix, ro.shared.preview.cuiPrefix]).toEqual(["CNP:", "CUI:"]);
    expect([en.shared.preview.cnpPrefix, en.shared.preview.cuiPrefix]).toEqual(["CNP:", "CUI:"]);
    expect([ro.shared.preview.fields.phone, ro.shared.preview.fields.email, ro.shared.preview.fields.notes]).toEqual(["Telefon", "Email", "Note"]);
    expect([en.shared.preview.fields.phone, en.shared.preview.fields.email, en.shared.preview.fields.notes]).toEqual(["Phone", "Email", "Notes"]);
    expect(ro.shared.preview.fields.tarla).toBe("Tarla/Solă");
    // „Tip document" is no longer asked for by the previews (its key stays for nobody).
  });

  // 40.98: the tile is 4 units of 119 px (3 of 148 until then), 524 px — about the 476 it was.
  it("the property's three rows, in order, in the 4-unit tile", () => {
    expect(PREVIEW_ROWS.property).toEqual([["parcela", "tarlaId", "surfaceAreaMp"], ["nickname"], ["carteFunciara", "cadastralNumber"]]);
    expect(PREVIEW_UNITS.panel).toBe(4);
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

/**
 * #39.28 — Adrian, 2026-10-13: a person's preview is the name; „the nickname and then „CNP:" and the actual number,
 * followed by date of birth and the place of birth"; the phone and the e-mail; and the notes, „truncated if it doesn't
 * fit". A company's: the name; the nickname and „CUI:"; the phone and the e-mail; the notes.
 */
describe("the persons' previews on four lines (#39.28)", () => {
  const NOTE = "Notă lungă ".repeat(30).trim();
  function draw(lines: Parameters<typeof PreviewTileBody>[0]["lines"]) {
    return render(<PreviewTileBody title="Pop Ana" fields={[]} lines={lines} openHref="/natural-persons/p1" labels={LABELS} onClose={() => {}} width="panel" />);
  }
  const text = (el: Element) =>
    [...el.querySelectorAll("[data-preview-value]")].map((v) => [...v.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("")).join("");

  it("line 2 reads „Poreclă · CNP: … · născută: date, place”; line 3 the phone · the e-mail; line 4 the notes", () => {
    const { container } = draw([
      [
        { label: "Poreclă", value: "Ani", sep: " · " },
        { label: "CNP", value: "2600312000000", prefix: "CNP:", sep: " · " },
        { label: "Data nașterii", value: "12.03.1960", prefix: "născută:", sep: ", " },
        { label: "Locul nașterii", value: "Bragadiru", sep: " · " },
      ],
      [{ label: "Telefon", value: "+40 700 000 001", sep: " · " }, { label: "Email", value: "ana@example.ro", sep: " · " }],
      [{ label: "Note", value: NOTE, cut: true }],
    ]);
    const lines = [...container.querySelectorAll("[data-preview-line]")];
    expect(lines.map(text)).toEqual(["Ani · CNP: 2600312000000 · născută: 12.03.1960, Bragadiru", "+40 700 000 001 · ana@example.ro", NOTE]);
  });

  it("the notes' line is cut, whole on hover, and takes the tile's width without adding any", () => {
    const { container } = draw([[{ label: "Poreclă", value: "Ani" }], [{ label: "Note", value: NOTE, cut: true }]]);
    const cut = container.querySelector<HTMLElement>("[data-preview-cut]")!;
    expect(cut.title).toBe(NOTE);
    expect(cut.className).toMatch(/\bw-0\b/);
    expect(cut.className).toMatch(/\bmin-w-full\b/);
    expect(cut.className).toMatch(/\btruncate\b/);
    expect(cut.className).not.toMatch(/whitespace-nowrap/);
  });

  it("a value the record lacks goes with its label and separator; a line with nothing is not drawn", () => {
    const { container } = draw([
      [
        { label: "Poreclă", value: null, sep: " · " },
        { label: "CNP", value: "2600312000000", prefix: "CNP:", sep: " · " },
        { label: "Data nașterii", value: null, prefix: "născută:", sep: ", " },
        { label: "Locul nașterii", value: "Bragadiru", sep: " · " },
      ],
      [{ label: "Telefon", value: null, sep: " · " }, { label: "Email", value: "", sep: " · " }],
      [{ label: "Note", value: null, cut: true }],
    ]);
    expect([...container.querySelectorAll("[data-preview-line]")].map(text)).toEqual(["CNP: 2600312000000 · Bragadiru"]);
    expect(container.textContent).not.toContain("născut");
  });

  it("every value missing: the name alone", () => {
    const { container } = draw([[{ label: "Poreclă", value: null }], [{ label: "Telefon", value: null }], [{ label: "Note", value: null, cut: true }]]);
    expect(container.querySelectorAll("[data-preview-line]")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Pop Ana" })).toBeTruthy();
  });

  it("preview-tiles builds them: „CNP:”, „CUI:”, the birth word, „ · ” and „, ”, the notes cut, no count after the name", () => {
    const tiles = readFileSync(join(process.cwd(), "src", "components", "tiles", "preview-tiles.tsx"), "utf8");
    // #39.30: + the death's word — it read „{ dateOfBirth: born, cnp: t("cnpPrefix"), cuiNumber: t("cuiPrefix") }".
    expect(tiles).toContain('const prefix: Record<string, string> = { dateOfBirth: born, dateOfDeath: died, cnp: t("cnpPrefix"), cuiNumber: t("cuiPrefix") };');
    expect(tiles).toContain('sep: name === "dateOfBirth" ? ", " : " · ",');
    expect(tiles).toContain('cut: name === "notes",');
    expect(tiles).not.toContain('t("contacts"');
  });
});
