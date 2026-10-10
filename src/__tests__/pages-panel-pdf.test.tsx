/**
 * Slice #38.81 — a PDF page alone: the frame asks the browser's viewer for no thumbnail column (`#navpanes=0`),
 * wherever „Pagini" draws it; an image is drawn as before.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { PagesPanel, PDF_VIEW_PARAMS, pdfFrameSrc, usePagesPanelState } from "@/app/documents/_components/pages-panel";

const DOC = "33333333-3333-4333-8333-333333333333";
const PDF = { id: "66666666-6666-4666-8666-666666666666", documentId: DOC, pageNumber: 1, pageName: null, pageNotes: null, fileName: "deed.pdf", fileSize: 10, mimeType: "application/pdf", rotation: 0, createdAt: "", updatedAt: "" };
const IMG = { ...PDF, id: "44444444-4444-4444-8444-444444444444", fileName: "scan.png", mimeType: "image/png" };

const answer = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

function Panel({ mode }: { mode: "view" | "peek" }) {
  const state = usePagesPanelState(DOC);
  return <PagesPanel documentId={DOC} mode={mode} state={state} />;
}
function draw(page: typeof PDF, mode: "view" | "peek" = "view") {
  global.fetch = jest.fn((url: string) =>
    url.endsWith("/view") ? answer({ url: `/api/files/${page.fileName}`, mimeType: page.mimeType, fileName: page.fileName }) : answer([page]),
  ) as unknown as typeof fetch;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Panel mode={mode} />
    </QueryClientProvider>,
  );
}
afterEach(() => {
  (global as { fetch?: unknown }).fetch = undefined;
});

describe("a PDF page alone (#38.81)", () => {
  it("adds navpanes=0 to the fragment, after any fragment the URL already has", () => {
    expect(PDF_VIEW_PARAMS).toBe("navpanes=0");
    expect(pdfFrameSrc("/api/files/a.pdf")).toBe("/api/files/a.pdf#navpanes=0");
    expect(pdfFrameSrc("/api/files/a.pdf#page=2")).toBe("/api/files/a.pdf#page=2&navpanes=0");
  });

  it.each(["view", "peek"] as const)("in %s mode a PDF is framed with it", async (mode) => {
    const { container } = draw(PDF, mode);
    await waitFor(() => expect(container.querySelector("iframe[data-pdf-frame]")).not.toBeNull());
    expect(container.querySelector("iframe")!.getAttribute("src")).toBe("/api/files/deed.pdf#navpanes=0");
  });

  it("an image is drawn as before, with no frame", async () => {
    const { container } = draw(IMG);
    await waitFor(() => expect(container.querySelector('img[alt="scan.png"]')).not.toBeNull());
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("is the one frame the panel draws a PDF in — so „Pagini extinse” gets it too", () => {
    const src = readFileSync(join(process.cwd(), "src", "app", "documents", "_components", "pages-panel.tsx"), "utf8");
    // An element, not a mention in a comment: `<iframe` at the start of a line of JSX.
    expect((src.match(/^\s*<iframe\s*$/gm) ?? []).length).toBe(1);
    expect(src).toContain("src={pdfFrameSrc(viewData.url)}");
  });
});
