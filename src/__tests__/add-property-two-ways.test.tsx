/**
 * „Adaugă proprietate": two ways in, and the text-file way asks for the parcel.            (Slice #39.65, FU-217)
 *
 * Replaces two suites, each for its reason:
 *   - `add-property-no-cadastral-identity.test.ts` bound the text, image and folder ways' payload — corners,
 *     provenance, notes and nickname, no tarla, no parcela — to the sentence admitting it (#34.07, D-18c). The way
 *     that stays now sends the tarla and the parcela, so that sentence is gone and this suite asserts the opposite:
 *     the identity is in the request, and the parcel check's 409 is shown.
 *   - `add-property-rescan.test.tsx` guarded a re-scan of the same photograph against saving its properties twice
 *     (#37.04, FU-017). The scanned-image way is gone, so there is nothing left for it to guard.
 *
 * The real dialog over a real query cache; only the router, translations and `fetch` are mocked. `useTranslations`
 * returns the key, so controls are found by their keys.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fs from "node:fs";
import path from "node:path";

jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/properties" }));
jest.mock("next/link", () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  default: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => (require("react") as typeof import("react")).createElement("a", { href, onClick }, children),
}));
jest.mock("@/components/record/use-name-or", () => ({ useNameOr: () => (v: string | null) => v ?? "—" }));

import { AddPropertyDialog } from "@/app/properties/_components/add-property-dialog";

const TARLA = [{ id: "11111111-1111-4111-8111-111111111111", indicativ: "T12", descriere: null }];
const CORNERS = [{ lat: 44.4, lon: 26.1, originalIndex: 16 }, { lat: 44.41, lon: 26.1, originalIndex: 17 }, { lat: 44.41, lon: 26.11, originalIndex: 18 }];

type Call = { url: string; method: string; body: unknown };

function mockFetch(createAnswer: { status: number; body: unknown }): Call[] {
  const calls: Call[] = [];
  const ok = (status: number, b: unknown) => ({ ok: status >= 200 && status < 300, status, redirected: false, json: async () => b });
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url, method: init?.method ?? "GET", body });
    if (url === "/api/admin/value-lists/tarla") return ok(200, { items: TARLA });
    if (url === "/api/properties/parse-text") return ok(200, { corners: CORNERS });
    if (url === "/api/properties") return ok(createAnswer.status, createAnswer.body);
    return ok(404, {});
  }) as unknown as typeof fetch;
  return calls;
}

function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AddPropertyDialog onClose={() => undefined} /></QueryClientProvider>);
}

/** jsdom's File has no `text()`; give the picked file one. */
function txtFile(name: string): File {
  const f = new File(["16\t318520.00\t573010.00\n"], name, { type: "text/plain" });
  Object.defineProperty(f, "text", { value: async () => "16\t318520.00\t573010.00\n" });
  return f;
}

async function toTextWay() {
  fireEvent.click(screen.getByText("choiceTextFile"));
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [txtFile("TC Teren.txt")] } });
  await waitFor(() => expect(screen.getByRole("option", { name: "T12" })).toBeTruthy());
}

const importButton = () => screen.getByRole("button", { name: "importButton" });

describe("the choice: two ways in", () => {
  it("manual entry and a text file — no scanned image, no folder, no work-in-progress note", () => {
    mockFetch({ status: 201, body: {} });
    open();
    expect(screen.getByText("choiceManual").closest("a")?.getAttribute("href")).toBe("/properties/new");
    expect(screen.getByText("choiceTextFile")).toBeTruthy();
    for (const gone of ["choiceScan", "choiceTextFolder", "wipNote", "noCadastralIdentityCard"]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });

  it("the source keeps no OCR, folder or photo code", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/app/properties/_components/add-property-dialog.tsx"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/scan-image|webkitdirectory|imageInputRef|PROPERTY_PHOTO_ACCEPT|noCadastralIdentity/);
    expect(fs.existsSync(path.join(process.cwd(), "src/app/api/properties/scan-image/route.ts"))).toBe(false);
  });
});

describe("the text file asks for the parcel (FU-217)", () => {
  it("„Importă” stays disabled until a file, a tarla and a parcela are given", async () => {
    mockFetch({ status: 201, body: {} });
    open();
    await toTextWay();
    expect(importButton()).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: TARLA[0].id } });
    expect(importButton()).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  225/3 " } });
    expect(importButton()).toHaveProperty("disabled", false);
  });

  it("sends the tarla, the parcela, the corners, the nickname and the provenance", async () => {
    const calls = mockFetch({ status: 201, body: { property: { id: "p-new" } } });
    open();
    await toTextWay();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: TARLA[0].id } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "225/3" } });
    await act(async () => { fireEvent.click(importButton()); });
    await waitFor(() => expect(screen.getByText("textImportDone")).toBeTruthy());
    const create = calls.find((c) => c.url === "/api/properties" && c.method === "POST")!.body as Record<string, unknown>;
    expect(create).toMatchObject({ tarlaId: TARLA[0].id, parcela: "225/3", nickname: "TC Teren" });
    expect((create.corners as unknown[]).length).toBe(3);
    expect(create.provenance).toBeTruthy();
    expect(screen.getByText("openNew").closest("a")?.getAttribute("href")).toBe("/properties/p-new");
  });

  it("a parcel that already has a property: nothing created, the message and a way to open it", async () => {
    mockFetch({
      status: 409,
      body: { code: "PARCEL_EXISTS", error: "x", matches: [{ id: "p-old", code: "PROP1", nickname: "Teren vechi", tarla: "T12", parcela: "225/3" }] },
    });
    open();
    await toTextWay();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: TARLA[0].id } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "225/3" } });
    await act(async () => { fireEvent.click(importButton()); });
    await waitFor(() => expect(document.querySelector("[data-parcel-exists]")).not.toBeNull());
    expect(screen.getByText("parcelExists.title")).toBeTruthy();
    expect(document.querySelector('[data-parcel-exists] a[href="/properties/p-old"]')).not.toBeNull();
    expect(screen.queryByText("textImportDone")).toBeNull();
  });
});
