/**
 * „Acte de identitate” drawn: the rows, the empty line, the kind's question, a version's old card values.  (Slice 40.85)
 * Invented values only.
 */
import { fireEvent, render, screen } from "@testing-library/react";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// The Romanian copy, as the screen reads it; `{name}` filled.
jest.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tree = require("../../messages/ro-RO.json") as Record<string, unknown>;
    const raw = `${ns}.${key}`.split(".").reduce<unknown>((n, k) => (n && typeof n === "object" ? (n as Record<string, unknown>)[k] : undefined), tree);
    if (typeof raw !== "string") return `${ns}.${key}`;
    return raw.replace(/\{(\w+)\}/g, (m, name: string) => (values && name in values ? String(values[name]) : m));
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PersonIdentityDocuments, newIdentityDocumentHref } = require("@/app/natural-persons/_components/person-identity-documents") as typeof import("@/app/natural-persons/_components/person-identity-documents");
import type { PersonIdentityDocument } from "@/lib/identity-documents/person-list";

const passport: PersonIdentityDocument = {
  id: "p1", code: "DOC00009", kind: "PASAPORT", typeName: "Pașaport", typeShortName: null, nrDocument: "051234876",
  dateDocument: "2022-09-01", dateValidUntil: "2099-09-01", issuerName: null,
};
const card: PersonIdentityDocument = {
  id: "c1", code: "DOC00003", kind: "CI_NOU", typeName: "Carte de Identitate (tip nou)", typeShortName: "CI", nrDocument: "IF 123456",
  dateDocument: "2010-04-21", dateValidUntil: "2020-04-21", issuerName: null,
};
const base = { personId: "person-1", soonDays: 90, title: "Acte de identitate", subtitle: "Actele de identitate ale persoanei, cel curent primul" };

beforeEach(() => push.mockClear());

it("lists the documents, the current one first, each opening its own", () => {
  const { container } = render(<PersonIdentityDocuments {...base} documents={[card, passport]} legacy={null} canAdd />);
  const rows = [...container.querySelectorAll("[data-identity-document]")];
  expect(rows.map((r) => r.getAttribute("data-identity-document"))).toEqual(["p1", "c1"]);
  expect(rows[0].textContent).toContain("Pașaport");
  expect(rows[0].textContent).toContain("01.09.2099");
  expect(rows[0].textContent).toContain("VALABIL");
  expect(rows[0].textContent).toContain("curent");
  expect(rows[1].textContent).toContain("CI");
  expect(rows[1].textContent).toContain("EXPIRAT");
  expect(screen.getByRole("link", { name: "DOC00003" }).getAttribute("href")).toBe("/documents/c1");
});

it("none: one line, „niciun act înregistrat”, and „Adaugă” asks the kind", () => {
  render(<PersonIdentityDocuments {...base} documents={[]} legacy={null} canAdd />);
  expect(screen.getByText("niciun act înregistrat")).toBeTruthy();
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByText("Ce act de identitate adăugați?")).toBeTruthy();
  expect(screen.getAllByRole("radio")).toHaveLength(4);
  fireEvent.click(screen.getByRole("radio", { name: "Pașaport CRDS" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuă" }));
  expect(push).toHaveBeenCalledWith(newIdentityDocumentHref("PASAPORT_CRDS", "person-1"));
  expect(newIdentityDocumentHref("CI_VECHE", "person-1")).toBe("/documents/new?identityKind=CI_VECHE&holder=person-1");
});

it("read-only, or a version viewed: no „Adaugă”", () => {
  render(<PersonIdentityDocuments {...base} documents={[passport]} legacy={null} canAdd={false} />);
  expect(screen.queryByRole("button", { name: "Adaugă act de identitate" })).toBeNull();
});

it("a version written before 40.85: its card values, read-only, under their old labels (Ask first 5)", () => {
  const { container } = render(
    <PersonIdentityDocuments
      {...base}
      documents={[]}
      legacy={{ idDocumentType: "ID_CARD", idDocumentNumber: "RX123456", idValidUntil: "2025-04-10", idMrzRaw: null }}
      canAdd={false}
    />,
  );
  const block = container.querySelector("[data-legacy-id-card]");
  expect(block).not.toBeNull();
  expect(block!.textContent).toContain("Tip document");
  expect(block!.textContent).toContain("Carte de identitate");
  expect(block!.textContent).toContain("Nr. document");
  expect(block!.textContent).toContain("RX123456");
  expect(block!.textContent).toContain("Până la");
  expect(block!.textContent).toContain("10.04.2025");
  expect(block!.textContent).not.toContain("MRZ");
  expect(container.querySelector("input, select, textarea")).toBeNull();
});
