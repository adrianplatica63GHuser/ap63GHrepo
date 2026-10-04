/**
 * @jest-environment node
 */

/**
 * Slice #37.80 — the view route tells a MISSING page file from any other
 * failure, on the server: 404 { missing: true } when the stored file is not
 * there (`fileUrlIfPresent`), 200 with its URL when it is. The viewer's half is
 * `missing-page-file.test.tsx`.
 */
jest.mock("@/lib/supabase/server", () => ({ createAdminClient: jest.fn() }));
jest.mock("fs/promises", () => ({ ...jest.requireActual("fs/promises"), access: jest.fn() }));
jest.mock("@/lib/documents/pages-queries", () => ({ __esModule: true, getDocumentPage: jest.fn() }));

import * as fsp from "fs/promises";
import { GET } from "@/app/api/documents/[id]/pages/[pageId]/view/route";
import { fileUrlIfPresent } from "@/lib/storage";
import * as pagesQueries from "@/lib/documents/pages-queries";

const access = fsp.access as unknown as jest.Mock;
const getDocumentPage = (pagesQueries as unknown as { getDocumentPage: jest.Mock }).getDocumentPage;

const DOC = "33333333-3333-4333-8333-333333333333";
const PAGE = { id: "44444444-4444-4444-8444-444444444444", documentId: DOC, pageNumber: 1, fileName: "p.png", mimeType: "image/png", filePath: `document-pages/${DOC}/p.png` };

describe("fileUrlIfPresent (local storage)", () => {
  it("is the /api/files URL when the file is there, null when it is not", async () => {
    access.mockResolvedValueOnce(undefined);
    await expect(fileUrlIfPresent(PAGE.filePath)).resolves.toBe(`/api/files/${PAGE.filePath}`);
    access.mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    await expect(fileUrlIfPresent(PAGE.filePath)).resolves.toBeNull();
  });
});

describe("GET /api/documents/[id]/pages/[pageId]/view", () => {
  const call = () => GET({} as never, { params: Promise.resolve({ id: DOC, pageId: PAGE.id }) });

  it("answers 404 { missing: true } for a page whose file is missing", async () => {
    getDocumentPage.mockResolvedValueOnce(PAGE);
    access.mockRejectedValueOnce(new Error("ENOENT"));
    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ missing: true });
  });

  it("answers 200 with the URL for one that is there", async () => {
    getDocumentPage.mockResolvedValueOnce(PAGE);
    access.mockResolvedValueOnce(undefined);
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: `/api/files/${PAGE.filePath}`, mimeType: "image/png", fileName: "p.png" });
  });

  it("answers 404 without `missing` for a page that does not exist", async () => {
    getDocumentPage.mockResolvedValueOnce(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect((await res.json()).missing).toBeUndefined();
  });
});
