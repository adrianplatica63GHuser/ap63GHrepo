/**
 * Slice #38.17 — „Rotește la dreapta" and „Salvează rotirea" in the „Pagini" tile.
 *
 * The panel's own state (`usePagesPanelState`), the buttons (`PagesPanel`) and
 * the viewer (`PagesViewerBox`), with the routes answered by a fetch mock:
 * a page opens at its stored turn; the turn cycles; „Salvează rotirea" is
 * enabled only while the turn shown differs from the stored one, and sends
 * it; a PDF page has both buttons disabled.
 */
import { useEffect, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { PagesPanel, PagesViewerBox, usePagesPanelState, type PagesPanelState } from "@/app/documents/_components/pages-panel";

const DOC = "33333333-3333-4333-8333-333333333333";
const IMG = { id: "44444444-4444-4444-8444-444444444444", documentId: DOC, pageNumber: 1, pageName: null, pageNotes: null, fileName: "scan.png", fileSize: 10, mimeType: "image/png", rotation: 180, createdAt: "", updatedAt: "" };
const PDF = { ...IMG, id: "66666666-6666-4666-8666-666666666666", fileName: "deed.pdf", mimeType: "application/pdf", rotation: 0 };

const answer = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

/** The page's routes, the stored turn kept as the database would keep it. */
function routes(page: typeof IMG) {
  let stored = page.rotation;
  return jest.fn((url: string, init?: RequestInit) => {
    if (url.endsWith("/view")) return answer(200, { url: `/api/files/${page.fileName}`, mimeType: page.mimeType, fileName: page.fileName });
    if (init?.method === "PATCH") {
      stored = JSON.parse(String(init.body)).rotation;
      return answer(200, { ...page, rotation: stored });
    }
    return answer(200, [{ ...page, rotation: stored }]);
  });
}

/** The panel's state as last rendered, for the assertions. */
const seen: { current: PagesPanelState | null } = { current: null };
function Harness() {
  const state = usePagesPanelState(DOC);
  useEffect(() => {
    seen.current = state;
  });
  return (
    <>
      <PagesPanel documentId={DOC} mode="view" state={state} />
    </>
  );
}

const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>
);

afterEach(() => {
  (global as { fetch?: unknown }).fetch = undefined;
  seen.current = null;
});

describe("the turn in the „Pagini” tile", () => {
  it("opens at the stored turn, drawn turned; „Salvează rotirea” disabled until the turn changes", async () => {
    global.fetch = routes(IMG) as unknown as typeof fetch;
    render(wrap(<Harness />));
    const rotate = await screen.findByRole("button", { name: "rotateRight" });
    await waitFor(() => expect(rotate).toBeEnabled());
    expect(seen.current?.turn).toBe(180);
    expect(screen.getByRole("button", { name: "saveRotation" })).toBeDisabled();
    // The viewer draws the stored turn (view mode: the turn is how a page is read).
    const img = screen.getByAltText("scan.png");
    expect(img).toHaveAttribute("data-rotation", "180");
    expect(img.getAttribute("style")).toContain("rotate(180deg)");
  });

  it("cycles 180 → 270 → 0 → 90 → 180; back at the stored turn, nothing to save", async () => {
    global.fetch = routes(IMG) as unknown as typeof fetch;
    render(wrap(<Harness />));
    const rotate = await screen.findByRole("button", { name: "rotateRight" });
    await waitFor(() => expect(rotate).toBeEnabled());
    const save = screen.getByRole("button", { name: "saveRotation" });
    const turns: number[] = [];
    for (let i = 0; i < 4; i++) {
      fireEvent.click(rotate);
      turns.push(seen.current!.turn);
      if (seen.current!.turn === 180) expect(save).toBeDisabled();
      else expect(save).toBeEnabled();
    }
    expect(turns).toEqual([270, 0, 90, 180]);
    expect(screen.getByAltText("scan.png")).toHaveAttribute("data-rotation", "180");
  });

  it("saves the turn shown through the page's route; then it is the stored one", async () => {
    const fetchMock = routes(IMG);
    global.fetch = fetchMock as unknown as typeof fetch;
    render(wrap(<Harness />));
    const rotate = await screen.findByRole("button", { name: "rotateRight" });
    await waitFor(() => expect(rotate).toBeEnabled());
    fireEvent.click(rotate); // 270
    const save = screen.getByRole("button", { name: "saveRotation" });
    expect(save).toBeEnabled();
    await act(async () => {
      fireEvent.click(save);
    });
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patch?.[0]).toBe(`/api/documents/${DOC}/pages/${IMG.id}`);
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ rotation: 270 });
    await waitFor(() => expect(seen.current?.storedTurn).toBe(270));
    expect(save).toBeDisabled();
  });

  it("a PDF page: both buttons disabled, their names saying why", async () => {
    global.fetch = routes(PDF) as unknown as typeof fetch;
    render(wrap(<Harness />));
    await waitFor(() => expect(seen.current?.viewData?.mimeType).toBe("application/pdf"));
    expect(screen.getByRole("button", { name: "rotateRightImagesOnly" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "saveRotationImagesOnly" })).toBeDisabled();
    expect(seen.current?.canTurn).toBe(false);
  });

  it("an unturned page is the <img> it always was", () => {
    const state = {
      t: (k: string) => k,
      viewLoading: false,
      viewError: null,
      viewMissing: false,
      viewData: { url: "/api/files/a.png", mimeType: "image/png", fileName: "a.png" },
      selectedPageId: IMG.id,
    } as unknown as PagesPanelState;
    render(<PagesViewerBox state={state} />);
    const img = screen.getByAltText("a.png");
    expect(img).toHaveAttribute("data-rotation", "0");
    expect(img).toHaveClass("max-h-[600px]", "max-w-full", "object-contain");
    expect(img.getAttribute("style")).toBeNull();
  });
});
