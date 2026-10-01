/**
 * The ID-card dialog keeps every ⚠ through the stacked layout.   (Slice #37.32)
 *
 * #37.32 moved „Creează persoană din cartea de identitate" onto the Natural
 * Person's rows, widths and labels, labels above their boxes. The ⚠ a
 * low-confidence reading puts beside a field's label is how a reviewer knows
 * which values to check against the card, so moving the labels must not drop
 * one: every field the reading can mark — the person's twelve and the home
 * address's five — still carries it, after its label.
 *
 * The real dialog over a real query cache; only translations and `fetch` are
 * mocked. `useTranslations` returns the key, so a label is found by its key:
 * `fields.*` (the Natural Person's, which the review now uses) and the
 * address block's own.
 */

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IdCardPersonDialog } from "@/app/admin/import/_components/id-card-person-dialog";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

type Json = Record<string, unknown>;
const json = (status: number, body: Json) =>
  ({ ok: status < 300, status, redirected: false, json: async () => body }) as unknown as Response;

/** What the reading can mark, by the extractor's names. */
const MARKED = [
  "lastName", "firstName", "gender", "dateOfBirth", "cnp", "idDocumentNumber", "idCardNumber",
  "placeOfBirth", "idIssuingAuthority", "idValidFrom", "idValidUntil", "citizenshipRaw",
  "addressStreetLine", "addressPostalCode", "addressLocality", "addressCounty", "addressCountry",
];

/** …and the label each one is shown under. */
const LABEL: Record<string, string> = {
  lastName: "fields.lastName",
  firstName: "fields.firstName",
  gender: "fields.gender",
  dateOfBirth: "fields.dateOfBirth",
  cnp: "fields.cnp",
  idDocumentNumber: "fields.idDocumentNumber",
  idCardNumber: "fields.idCardNumber",
  placeOfBirth: "fields.placeOfBirth",
  idIssuingAuthority: "fields.idIssuingAuthority",
  idValidFrom: "fields.idValidFrom",
  idValidUntil: "fields.idValidUntil",
  citizenshipRaw: "fields.citizenship",
  addressStreetLine: "streetLine",
  addressPostalCode: "postalCode",
  addressLocality: "locality",
  addressCounty: "county",
  addressCountry: "country",
};

function mockFetch(marked: string[]) {
  global.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u === "/api/admin/import/extract-id-card") {
      return json(200, {
        fields: {
          lastName: "EXEMPLU",
          firstName: "ANA",
          gender: "FEMALE",
          dateOfBirth: "1990-01-02",
          cnp: "2900102000000",
          idDocumentNumber: "ZZ000001",
          idCardNumber: "000000001",
          placeOfBirth: "Localitatea Exemplu",
          idIssuingAuthority: "SPCLEP Exemplu",
          idValidFrom: "2020-01-02",
          idValidUntil: "2030-01-02",
          citizenshipRaw: "ROU",
          addressStreetLine: "Str. Exemplu nr. 1",
          addressPostalCode: "000001",
          addressLocality: "Exemplu",
          addressCounty: "Exemplu",
          addressCountry: "România",
        },
        lowConfidenceFields: marked,
        unmappedRaw: {},
      });
    }
    if (u === "/api/admin/import/resolve-natural-person") {
      return json(200, { matchCandidate: null, possibleMatches: [], searchedName: null });
    }
    if (u.startsWith("/api/admin/value-lists/")) return json(200, { items: [] });
    return json(404, {});
  }) as unknown as typeof fetch;
}

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <IdCardPersonDialog
        file={new File([new Uint8Array([1])], "card.jpg", { type: "image/jpeg" })}
        entryLabel="card.jpg"
        propertyId="p-1"
        documentId="d-1"
        onDone={() => undefined}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

const marks = (label: string) => screen.getByText(label).querySelectorAll("[data-low-confidence]").length;

describe("the ID-card dialog's ⚠ marks, on the stacked review (Slice #37.32)", () => {
  it("every field the reading marked carries one ⚠, after its label", async () => {
    mockFetch(MARKED);
    renderDialog();
    await screen.findByText(LABEL.lastName, {}, { timeout: 5000 });
    for (const k of MARKED) expect([k, marks(LABEL[k])]).toEqual([k, 1]);
  });

  it("a field the reading was sure of carries none", async () => {
    mockFetch([]);
    renderDialog();
    await screen.findByText(LABEL.lastName, {}, { timeout: 5000 });
    for (const k of MARKED) expect([k, marks(LABEL[k])]).toEqual([k, 0]);
  });

  it("the review is the Natural Person's three panels, in the wide card", async () => {
    mockFetch([]);
    const { container } = renderDialog();
    await screen.findByText(LABEL.lastName, {}, { timeout: 5000 });
    expect(container.querySelector('[data-panel="identity"]')).not.toBeNull();
    expect(container.querySelector('[data-panel="id-card"]')).not.toBeNull();
    expect(container.querySelector('[data-panel="addresses.HOME"]')).not.toBeNull();
    expect(container.querySelector('[data-dialog-card="wide"]')).not.toBeNull();
  });
});
