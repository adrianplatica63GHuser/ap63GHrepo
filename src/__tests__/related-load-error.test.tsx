/**
 * „Legături": one kind's list that does not load says which, why, offers „Reîncearcă", and blanks nothing else.
 *                                                                                                   (Slice 40.16)
 *
 * Adrian, 2026-10-21: „when I opened a principal object form: the links tile cannot load its items; Failed to load!".
 * The real tiles of a person and of a property over a real query cache, `fetch` mocked: one kind answers an error,
 * the others their rows (Ask first 3). `useTranslations` returns the key, its values after a „:".
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { PersonRelatedTile } from "@/app/natural-persons/_components/person-related-tile";
import { PropertyRelatedTile } from "@/app/properties/_components/property-related-tile";
import { loadFailure, statusOfError } from "@/lib/http/load-failure";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join("|")}` : key,
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
jest.mock("@/components/providers/unsaved-changes-provider", () => ({
  useUnsavedChanges: () => ({ guardedNavigate: jest.fn() }),
}));
jest.mock("@/components/tiles/preview-tiles", () => ({ PreviewButton: () => null }));

const ITEMS: Record<string, unknown[]> = {
  "/api/people/me/references": [{ id: "p1", code: "PPERS1", type: "NATURAL", displayName: "Maria", associatedAt: "", relationshipRoleId: null, relationshipRoleName: null, roleShown: { kind: "none" } }],
  "/api/people/me/properties": [{ id: "r1", code: "PROP2", label: "Teren", roleName: "Proprietar", associatedAt: "" }],
  "/api/people/me/documents": [{ linkId: "l1", id: "d1", code: "DOC1", typeName: "Contract de Vânzare", title: "CVC 1", roleName: "Vânzător", associatedAt: "" }],
  "/api/properties/prop/persons": [{ id: "p1", code: "PPERS1", type: "NATURAL", displayName: "Ion", roleName: null, associatedAt: "" }],
  "/api/properties/prop/references": [{ id: "r2", code: "PROP3", label: "Vecina", associatedAt: "", relationshipRoleId: null, relationshipRoleName: null, roleReadsFromViewed: false }],
  "/api/properties/prop/documents": [{ id: "d2", code: "DOC2", typeName: "Plan", title: "Plan 1", associatedAt: "" }],
};

/** `failing` answers `status` (or throws, for "network") until `heal()` is called; everything else its rows. */
function mockFetch(failing: string, status: number | "network" | "html") {
  let healed = false;
  const calls: string[] = [];
  global.fetch = jest.fn(async (url: string) => {
    calls.push(url);
    if (url === failing && !healed) {
      if (status === "network") throw new TypeError("Failed to fetch");
      if (status === "html") return { ok: true, status: 200, json: async () => JSON.parse("<!DOCTYPE html>") };
      return { ok: false, status, json: async () => ({ error: "Failed to load" }) };
    }
    return { ok: true, status: 200, json: async () => ({ items: ITEMS[url] ?? [] }) };
  }) as unknown as typeof fetch;
  return { calls, heal: () => { healed = true; } };
}

function renderWith(tile: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{tile}</QueryClientProvider>);
}

const contents = () => [...document.querySelectorAll("[data-row-content]")].map((c) => c.textContent);

describe("loadFailure — the reason from the fetcher's status", () => {
  it.each([
    [new Error("HTTP 401"), "signedOut", 401],
    [new Error("HTTP 403"), "forbidden", 403],
    [new Error("HTTP 404"), "notFound", 404],
    [new Error("HTTP 500"), "database", 500],
    [new Error("HTTP 503"), "database", 503],
    [new Error("HTTP 418"), "other", 418],
    [new TypeError("Failed to fetch"), "network", null],
    [new SyntaxError("Unexpected token '<'"), "unreadable", null],
  ] as const)("%s → %s", (err, failure, status) => {
    expect(loadFailure(err)).toEqual({ failure, status });
  });

  it("reads only the fetchers' own shape", () => {
    expect(statusOfError(new Error("HTTP 404"))).toBe(404);
    expect(statusOfError(new Error("Failed to load"))).toBeNull();
    expect(statusOfError("HTTP 404")).toBeNull();
  });
});

describe("a person's „Legături” with one kind failing", () => {
  it("the other kinds still show; the failed one says which, why, and „Reîncearcă” brings it back", async () => {
    const net = mockFetch("/api/people/me/properties", 500);
    renderWith(<PersonRelatedTile personId="me" backBase="/natural-persons" label="Legături" />);
    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-related-load-failed")).toBe("database");
    expect(alert.textContent).toContain("failed:error|reasons.database");
    expect(alert.textContent).not.toContain("Failed to load");
    await waitFor(() => expect(contents().some((c) => c?.includes("Maria"))).toBe(true));
    expect(contents().some((c) => c?.includes("CVC 1"))).toBe(true);
    expect(contents().some((c) => c?.includes("Teren"))).toBe(false);

    net.heal();
    fireEvent.click(within(alert).getByRole("button", { name: "retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(contents().some((c) => c?.includes("Teren"))).toBe(true);
    expect(net.calls.filter((u) => u === "/api/people/me/properties")).toHaveLength(2);
  });

  it.each([
    [401, "signedOut"],
    [403, "forbidden"],
    [404, "notFound"],
    ["network", "network"],
    ["html", "unreadable"],
  ] as const)("a list answering %s says %s", async (status, failure) => {
    mockFetch("/api/people/me/documents", status);
    renderWith(<PersonRelatedTile personId="me" backBase="/natural-persons" label="Legături" />);
    expect((await screen.findByRole("alert")).getAttribute("data-related-load-failed")).toBe(failure);
  });
});

describe("a property's „Legături” with one kind failing", () => {
  it("its documents' 404 is named, and the persons and properties are there", async () => {
    mockFetch("/api/properties/prop/documents", 404);
    renderWith(<PropertyRelatedTile propertyId="prop" label="Legături" />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("reasons.notFound");
    await waitFor(() => expect(contents().some((c) => c?.includes("Ion"))).toBe(true));
    expect(contents().some((c) => c?.includes("Vecina"))).toBe(true);
  });
});

describe("one kind still loading blanks nothing", () => {
  it("the rows that arrived show while another kind's answer has not come", async () => {
    global.fetch = jest.fn((url: string) =>
      url === "/api/people/me/documents"
        ? new Promise(() => undefined)
        : Promise.resolve({ ok: true, status: 200, json: async () => ({ items: ITEMS[url] ?? [] }) }),
    ) as unknown as typeof fetch;
    renderWith(<PersonRelatedTile personId="me" backBase="/natural-persons" label="Legături" />);
    await waitFor(() => expect(contents().some((c) => c?.includes("Teren"))).toBe(true));
    expect(screen.queryByText("loading")).toBeNull();
  });
});
