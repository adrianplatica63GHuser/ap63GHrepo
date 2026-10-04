/**
 * Slice #37.80 — a page whose file cannot be had shows a quiet picture, not an error.
 *
 * The view route's 404 { missing: true } (`missing-page-file-route.test.ts`)
 * is read by the panel's state as `viewMissing`, and `PagesViewerBox` draws
 * the muted ImageOff picture for it — never „viewer.error".
 */
import type { ReactNode } from "react";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { PagesViewerBox, usePagesPanelState, type PagesPanelState } from "@/app/documents/_components/pages-panel";

const DOC = "33333333-3333-4333-8333-333333333333";
const PAGE = { id: "44444444-4444-4444-8444-444444444444", documentId: DOC, pageNumber: 1, fileName: "p.png", mimeType: "image/png", filePath: `document-pages/${DOC}/p.png` };

describe("the viewer", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
  );
  const answer = (status: number, body: unknown) =>
    Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

  afterEach(() => {
    (global as { fetch?: unknown }).fetch = undefined;
  });

  it("a 404 { missing } is `viewMissing`, not an error; another failure is still an error", async () => {
    const fetchMock = jest.fn((url: string) =>
      url.endsWith("/view") ? answer(404, { error: "File not found", missing: true }) : answer(200, [PAGE]),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => usePagesPanelState(DOC), { wrapper });
    await waitFor(() => expect(result.current.viewMissing).toBe(true));
    expect(result.current.viewError).toBeNull();
    expect(result.current.viewData).toBeNull();

    fetchMock.mockImplementation((url: string) => (url.endsWith("/view") ? answer(500, { error: "boom" }) : answer(200, [PAGE])));
    await act(async () => {
      await result.current.loadView(PAGE as never);
    });
    expect(result.current.viewMissing).toBe(false);
    expect(result.current.viewError).not.toBeNull();
  });

  it("draws the muted picture with its name for a missing file — no „viewer.error”", () => {
    const state = {
      t: (k: string) => k,
      viewLoading: false,
      viewError: null,
      viewMissing: true,
      viewData: null,
      selectedPageId: PAGE.id,
    } as unknown as PagesPanelState;
    render(<PagesViewerBox state={state} />);
    const picture = screen.getByRole("img", { name: "viewer.missing" });
    expect(picture).toHaveAttribute("title", "viewer.missing");
    expect(picture.querySelector("svg")).toHaveClass("text-fade");
    expect(screen.queryByText("viewer.error")).toBeNull();
    expect(screen.queryByText("viewer.placeholder")).toBeNull();
  });
});
