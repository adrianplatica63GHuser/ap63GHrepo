/**
 * @jest-environment node
 */

/**
 * Slice #38.17 — PATCH /api/documents/[id]/pages/[pageId] stores a page's
 * turn: 0, 90, 180 or 270 and nothing else, on that document's own page.
 */
jest.mock("@/lib/supabase/server", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/documents/pages-queries", () => ({
  __esModule: true,
  getDocumentPage: jest.fn(),
  updateDocumentPageRotation: jest.fn(),
  deleteDocumentPage: jest.fn(),
}));

import { PATCH } from "@/app/api/documents/[id]/pages/[pageId]/route";
import * as pagesQueries from "@/lib/documents/pages-queries";

const q = pagesQueries as unknown as { getDocumentPage: jest.Mock; updateDocumentPageRotation: jest.Mock };
const DOC = "33333333-3333-4333-8333-333333333333";
const OTHER = "55555555-5555-4555-8555-555555555555";
const PAGE = { id: "44444444-4444-4444-8444-444444444444", documentId: DOC, pageNumber: 1, fileName: "p.png", mimeType: "image/png", rotation: 0 };

const call = (body: unknown, raw = false) =>
  PATCH({ json: () => (raw ? Promise.reject(new SyntaxError("bad")) : Promise.resolve(body)) } as never, {
    params: Promise.resolve({ id: DOC, pageId: PAGE.id }),
  });

beforeEach(() => {
  q.getDocumentPage.mockReset();
  q.updateDocumentPageRotation.mockReset();
});

describe("PATCH /api/documents/[id]/pages/[pageId]", () => {
  it.each([[0], [90], [180], [270]])("stores %i", async (rotation) => {
    q.getDocumentPage.mockResolvedValueOnce(PAGE);
    q.updateDocumentPageRotation.mockResolvedValueOnce({ ...PAGE, rotation });
    const res = await call({ rotation });
    expect(res.status).toBe(200);
    expect((await res.json()).rotation).toBe(rotation);
    expect(q.updateDocumentPageRotation).toHaveBeenCalledWith(PAGE.id, rotation);
  });

  it.each([[{ rotation: 45 }], [{ rotation: 360 }], [{ rotation: -90 }], [{ rotation: "90" }], [{ rotation: null }], [{}], [{ rotation: 90, pageName: "x" }], [null], [[90]]])(
    "refuses %j — 400, nothing stored",
    async (body) => {
      const res = await call(body);
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("invalid_rotation");
      expect(q.updateDocumentPageRotation).not.toHaveBeenCalled();
    },
  );

  it("refuses a body that is not JSON", async () => {
    const res = await call(undefined, true);
    expect(res.status).toBe(400);
    expect(q.updateDocumentPageRotation).not.toHaveBeenCalled();
  });

  it("answers 404 for a page that does not exist, or belongs to another document", async () => {
    q.getDocumentPage.mockResolvedValueOnce(undefined);
    expect((await call({ rotation: 90 })).status).toBe(404);
    q.getDocumentPage.mockResolvedValueOnce({ ...PAGE, documentId: OTHER });
    expect((await call({ rotation: 90 })).status).toBe(404);
    expect(q.updateDocumentPageRotation).not.toHaveBeenCalled();
  });
});
