/**
 * A Previzualizare tile shows its fields as the record's screen does.
 *                                                              (Slice #37.33)
 *
 * Labels above their values, fields sharing a row as on the screen, each at its
 * screen width (a field without one takes the tile's whole inner width), and
 * the tile itself whole width units: 3 for a person, 4 for a document.
 * `preview-tiles.test.tsx` (#37.24) holds what a preview may and may not do,
 * unedited; this holds how it is laid out.
 */
import { render, screen } from "@testing-library/react";
import { PreviewTileBody } from "@/components/tiles/preview-tile-body";
import { NATURAL_PERSON, boxRem } from "@/lib/ui/field-widths";

const LABELS = { open: "Deschide", close: "Închide", readonly: "Numai citire", firstPage: "Prima pagină", noPage: "Nicio pagină" };

function renderPerson(width: "panel" | "pages" = "panel") {
  return render(
    <PreviewTileBody
      title="Ion Exemplu"
      fields={[
        { label: "Nume", value: "Exemplu", width: NATURAL_PERSON.lastName, row: 0 },
        { label: "Prenume", value: "Ion", width: NATURAL_PERSON.firstName, row: 0 },
        { label: "CNP", value: null, width: NATURAL_PERSON.cnp, row: 1 },
        { label: "Locul nașterii", value: "Localitatea Exemplu", width: NATURAL_PERSON.placeOfBirth, row: 2 },
      ]}
      openHref="/natural-persons/1?readonly=true"
      labels={LABELS}
      onClose={() => {}}
      width={width}
    />,
  );
}

const fieldOf = (label: string) => screen.getByText(label).parentElement as HTMLElement;

describe("a preview's fields, laid out as on the record's screen (#37.33)", () => {
  it("puts the label above its value, and two fields of one screen row on one row", () => {
    renderPerson();
    const nume = fieldOf("Nume");
    expect(nume.firstElementChild?.textContent).toBe("Nume");
    expect(nume.lastElementChild?.textContent).toBe("Exemplu");
    expect(fieldOf("Prenume").parentElement).toBe(nume.parentElement);
    expect(fieldOf("CNP").parentElement).not.toBe(nume.parentElement);
    expect(fieldOf("CNP").lastElementChild?.textContent).toBe("—");
  });

  it("gives each field its screen width", () => {
    renderPerson();
    expect(fieldOf("Nume").style.width).toBe(`${boxRem(NATURAL_PERSON.lastName)}rem`);
    expect(fieldOf("CNP").style.width).toBe(`${boxRem(NATURAL_PERSON.cnp)}rem`);
  });

  it("is 3 units for a person, 4 for a document", () => {
    const { container, unmount } = renderPerson("panel");
    expect((container.querySelector("[data-preview]") as HTMLElement).style.width).toBe("29.75rem");
    unmount();
    const doc = renderPerson("pages");
    expect((doc.container.querySelector("[data-preview]") as HTMLElement).style.width).toBe("40rem");
  });
});
