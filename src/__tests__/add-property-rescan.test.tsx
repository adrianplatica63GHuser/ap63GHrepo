/**
 * Back and a re-scan of the same image does not create its properties twice.
 *                                                    (Slice #37.04, FU-017)
 *
 * THE DEFECT
 * ──────────
 * „Adaugă proprietate" → „Din imagine" saves the boundaries a scan found one
 * by one, and on a failure returns to the count step, from which a second
 * „Salvează" RESUMES — the ids already written are kept (#32.20). But „Înapoi"
 * from that step and „Procesează" again on the same photograph cleared them:
 * a new scan was treated as a new set of boundaries, so the first property was
 * written a second time. Now what was saved is kept per image — the same file
 * scanned again resumes where the last save stopped, and the count step says
 * how many are already saved; a different image starts from nothing.
 *
 * The real dialog, over a real query cache; only the router, translations and
 * `fetch` are mocked. `useTranslations` returns the key, so buttons are found
 * by their `property.addDialog.*` keys.
 *
 * RED ON THE CODE BEFORE THIS SLICE: committed on its own, ahead of the fix.
 */

import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddPropertyDialog } from "@/app/properties/_components/add-property-dialog";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
  usePathname: () => "/properties",
}));
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("react") as typeof import("react")).createElement("a", null, children),
}));

const FIRST = [{ lat: 44.1, lon: 26.1, originalIndex: 1 }, { lat: 44.2, lon: 26.2, originalIndex: 2 }, { lat: 44.3, lon: 26.1, originalIndex: 3 }];
const SECOND = [{ lat: 45.1, lon: 27.1, originalIndex: 1 }, { lat: 45.2, lon: 27.2, originalIndex: 2 }, { lat: 45.3, lon: 27.1, originalIndex: 3 }];

type Json = Record<string, unknown>;
const json = (status: number, body: Json) =>
  ({ ok: status < 300, status, redirected: false, json: async () => body }) as unknown as Response;

let creates: Json[];
let failNextSecond: boolean;

beforeEach(() => {
  creates = [];
  failNextSecond = true;
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith("/api/properties/scan-image")) {
      return json(200, { properties: [{ corners: FIRST }, { corners: SECOND }], labels: [] });
    }
    if (u === "/api/properties" && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Json;
      const isSecond = JSON.stringify(body.corners).includes("45.1");
      if (isSecond && failNextSecond) {
        failNextSecond = false;
        return json(500, { error: "Eroare trecătoare" });
      }
      creates.push(body);
      return json(201, { property: { id: `prop-${creates.length}` } });
    }
    return json(404, {});
  }) as unknown as typeof fetch;
});

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AddPropertyDialog onClose={() => undefined} />
    </QueryClientProvider>,
  );
}

const photo = new File(["pixels"], "tabel-coordonate.jpg", { type: "image/jpeg", lastModified: 1_700_000_000_000 });

async function scan(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "processButton" }));
  // Two boundaries: the count step.
  await screen.findByText("selectCountTitle");
}

async function saveBoth() {
  fireEvent.click(screen.getAllByRole("radio")[1]);
  const buttons = screen.getAllByRole("button", { name: "savingProperties" });
  fireEvent.click(buttons[buttons.length - 1]);
}

const createsOf = (corners: typeof FIRST) =>
  creates.filter((b) => JSON.stringify(b.corners) === JSON.stringify(corners.map((c) => ({ ...c })))).length;

describe("„Din imagine”: Back, and the same photograph scanned again (FU-017)", () => {
  it("does not write the first property twice", async () => {
    renderDialog();
    fireEvent.click(screen.getByText("choiceScan"));
    await scan(photo);

    // Save both: the first is written, the second fails; back on the count step.
    await saveBoth();
    await screen.findByText("Eroare trecătoare");
    expect(createsOf(FIRST)).toBe(1);

    // „Înapoi", then the same photograph again, and save both.
    fireEvent.click(screen.getByRole("button", { name: "back" }));
    await scan(photo);
    await saveBoth();

    await waitFor(() => expect(createsOf(SECOND)).toBe(1));
    expect(createsOf(FIRST)).toBe(1);
  });

  it("a different photograph starts from nothing", async () => {
    renderDialog();
    fireEvent.click(screen.getByText("choiceScan"));
    await scan(photo);
    await saveBoth();
    await screen.findByText("Eroare trecătoare");

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    const other = new File(["other pixels"], "alt-tabel.jpg", { type: "image/jpeg", lastModified: 1_700_000_100_000 });
    await scan(other);
    await saveBoth();

    // A new image is a new set of boundaries: both are written for it.
    await waitFor(() => expect(createsOf(SECOND)).toBe(1));
    expect(createsOf(FIRST)).toBe(2);
  });
});
