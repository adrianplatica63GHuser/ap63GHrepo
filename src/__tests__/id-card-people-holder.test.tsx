/**
 * Slice 41.33 — Adrian: „If a “Pașaport” already have a holder disable the button “Create people from the ID Card”,
 * and on hover give a hint that this document already has a holder".
 *
 * On every identity kind: with a „Titular act de identitate" linked, „Creează persoane din CI" is aria-disabled (kept
 * focusable, so its note reaches the keyboard) and its note names the holder; while the holder loads it is disabled
 * with no note; with none it works as before. The holder is the holder line's own query, so the two never disagree.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock("@/app/admin/import/_components/id-card-person-dialog", () => ({ IdCardPersonDialog: () => null }));
jest.mock("@/app/admin/import/_components/id-card-image", () => ({ cardImageFromFile: (f: File) => f }));
jest.mock("@/hooks/use-time-frames", () => ({ useTimeFrames: () => ({ data: undefined }), tfDays: () => 30 }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { IdCardPeopleAction } = require("@/app/documents/_components/id-card-people-action") as typeof import("@/app/documents/_components/id-card-people-action");

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

function renderWith(persons: unknown[] | "pending") {
  const fetchMock = jest.fn((url: string) => {
    if (persons === "pending") return new Promise(() => undefined);
    if (url.endsWith("/persons")) return Promise.resolve({ ok: true, redirected: false, json: async () => ({ items: persons }) });
    return Promise.resolve({ ok: true, redirected: false, json: async () => [] });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <IdCardPeopleAction documentId="doc-1" title="Pașaport" />
    </QueryClientProvider>,
  );
  return fetchMock;
}

const button = () => screen.getByRole("button", { name: "action" });

describe("41.33 — „Creează persoane din CI” and the act's holder", () => {
  it("a holder linked: aria-disabled, focusable, its note names the holder; a press reads nothing", async () => {
    const fetchMock = renderWith([{ id: "p1", code: "PPERS1", type: "NATURAL", displayName: "Ion Testescu", roleName: "Titular act de identitate" }]);
    await waitFor(() => expect(document.querySelector('[data-id-card-people-blocked="holder"]')).not.toBeNull());
    expect(button()).toHaveAttribute("aria-disabled", "true");
    expect(button()).not.toBeDisabled();
    expect(screen.getByText('hasHolder:{"name":"Ion Testescu"}')).toBeInTheDocument();
    fireEvent.click(button());
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/pages"))).toBe(false);
  });

  it("no holder: enabled, no note", async () => {
    renderWith([{ id: "p2", code: "PPERS2", type: "NATURAL", displayName: "Altcineva", roleName: "Vânzător" }]);
    await waitFor(() => expect(button()).not.toHaveAttribute("aria-disabled"));
    expect(screen.queryByText(/hasHolder/)).toBeNull();
  });

  it("while the holder loads: disabled, with no note", () => {
    renderWith("pending");
    expect(button()).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText(/hasHolder/)).toBeNull();
  });

  it("one query, one cache: the holder line and the button read the same hook", () => {
    const parts = read("src", "app", "documents", "_components", "identity-tile-parts.tsx");
    expect(parts).toContain('queryKey: ["document-persons", documentId, "holder"]');
    expect(parts).toMatch(/export function IdentityHolderLine[\s\S]*useIdentityHolder\(documentId\)/);
    expect(read("src", "app", "documents", "_components", "id-card-people-action.tsx")).toContain("useIdentityHolder(documentId)");
  });

  it("the hint in both languages, Romanian first", () => {
    expect(JSON.parse(read("messages", "ro-RO.json")).document.idCardPeople.hasHolder).toBe("Actul are deja un titular: {name}");
    expect(JSON.parse(read("messages", "en-GB.json")).document.idCardPeople.hasHolder).toBe("This document already has a holder: {name}");
  });
});
