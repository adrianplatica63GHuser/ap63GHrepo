/**
 * @jest-environment node
 */

/**
 * POST /api/documents/[id]/pages — what may become a page   (Slice #34.06)
 *
 * ⚠️ **THIS FILE EXISTS BECAUSE THE FIRST DRAFT OF #34.06 DID NOT HAVE IT**, and
 * the slice's own adversarial review found that every other guard on this route
 * reads its SOURCE TEXT. `expect(route).toContain("isUploadableFileName(file.name)")`
 * stays green when the `!` is deleted — a one-character edit that makes the
 * route refuse every `.pdf` and accept every `.exe`. A route that decides what
 * enters the archive has to be exercised, not read.
 *
 * The DB layer and storage are mocked, in the style of corner-source-api.test.ts;
 * what is under test is the admission contract:
 *
 *   • every extension the registry calls archive material is accepted
 *   • every extension it does not is refused with 415, ignored and forbidden
 *     kinds alike, and so is one it has never heard of
 *   • TYPE is decided before SIZE, so an oversized `.heic` is told the thing
 *     about it that can actually be fixed
 *   • the recorded MIME type comes from the extension, including when the
 *     browser sent none — the Windows case this whole slice turns on
 */

jest.mock("@/lib/storage", () => ({
  __esModule: true,
  uploadFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/documents/pages-queries", () => ({
  __esModule: true,
  createDocumentPage: jest.fn(),
  listDocumentPages: jest.fn().mockResolvedValue([]),
}));

import type { NextRequest } from "next/server";
import { POST } from "@/app/api/documents/[id]/pages/route";
import {
  KNOWN_EXTENSIONS,
  UPLOADABLE_EXTENSIONS,
} from "@/lib/files/file-kinds";
import { MAX_UPLOAD_BYTES } from "@/lib/import/constraint-rules";
import * as pagesQueries from "@/lib/documents/pages-queries";
import * as storage from "@/lib/storage";

const queryMocks = pagesQueries as unknown as {
  createDocumentPage: jest.Mock;
  listDocumentPages: jest.Mock;
};
const storageMocks = storage as unknown as { uploadFile: jest.Mock };

const DOC = "33333333-3333-4333-8333-333333333333";

const NOT_UPLOADABLE = KNOWN_EXTENSIONS.filter(
  (ext) => !UPLOADABLE_EXTENSIONS.includes(ext),
);

type PostArgs = {
  name: string;
  /**
   * ⚠️ **`""` DOES NOT SURVIVE THE ROUND TRIP, and that is undici's doing, not
   * the route's.** The multipart serializer writes
   * `Content-Type: application/octet-stream` for a `File` whose `type` is
   * empty, and the parser reads that back — so passing `""` here delivers
   * `application/octet-stream` to the handler. That is the same VALUE the old
   * block list collapsed an empty type to, so these cases still exercise the
   * substitution the slice turns on; they simply cannot claim to reproduce the
   * empty string at the HTTP boundary, and the names below no longer do.
   */
  type?: string;
  size?: number;
};

/**
 * POST one file to the route.
 *
 * A real `File` and a real `FormData` — the route calls `req.formData()` and
 * nothing else off the request, so a plain `Request` cast to `NextRequest` is
 * the whole boundary. `size` is honoured by allocating that many bytes, which
 * is why the oversize case uses a sparse-ish 1-byte-over rather than 20 MB of
 * random data.
 */
async function post({ name, type = "", size = 4 }: PostArgs): Promise<Response> {
  const file = new File([new Uint8Array(size)], name, type ? { type } : undefined);
  const fd = new FormData();
  fd.append("file", file, name);
  fd.append("pageNumber", "1");
  const req = new Request("http://localhost/api/documents/x/pages", {
    method: "POST",
    body: fd,
  }) as unknown as NextRequest;
  return POST(req, { params: Promise.resolve({ id: DOC }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  queryMocks.createDocumentPage.mockImplementation(async (arg: unknown) => arg);
  storageMocks.uploadFile.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Admission
// ---------------------------------------------------------------------------

describe("the route accepts exactly the registry's uploadable set", () => {
  it.each([...UPLOADABLE_EXTENSIONS])("accepts %s", async (ext) => {
    const res = await post({ name: `scan${ext}` });
    expect(res.status).toBe(201);
    expect(storageMocks.uploadFile).toHaveBeenCalledTimes(1);
  });

  it.each([...UPLOADABLE_EXTENSIONS])("accepts %s spelled in capitals", async (ext) => {
    const res = await post({ name: `SCAN${ext.toUpperCase()}` });
    expect(res.status).toBe(201);
  });

  it.each([...NOT_UPLOADABLE])("refuses %s with 415", async (ext) => {
    const res = await post({ name: `scan${ext}` });
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual(
      expect.objectContaining({ code: "file_type_not_allowed" }),
    );
    expect(storageMocks.uploadFile).not.toHaveBeenCalled();
    expect(queryMocks.createDocumentPage).not.toHaveBeenCalled();
  });

  it.each([
    "setup.exe",
    "run.sh",
    "app.js",
    "photo.heic",
    "photo.HEIC",
    "burst.heics",
    "canon.hif",
    "page.html",
    "export.xml",
    "export.csv",
    "README",
    ".pdf",
    "archive.tar.gz",
  ])("refuses %s, which the registry does not call archive material", async (name) => {
    const res = await post({ name });
    expect(res.status).toBe(415);
  });

  it("refuses a .heic even when the browser calls it an image", async () => {
    // The old block list asked `file.type`; this asserts the new answer does
    // not, because a browser that types a HEIC as image/heic is telling the
    // truth and it still cannot be shown to anyone.
    const res = await post({ name: "IMG_1.heic", type: "image/heic" });
    expect(res.status).toBe(415);
  });

  it("refuses an executable that arrives as application/octet-stream", async () => {
    // The Windows shape, and the reason the old block list was theatre: the
    // File System Access API leaves `File.type` empty, the multipart layer
    // turns that into `application/octet-stream`, and that value was in no
    // block list — so the one file most likely to be hostile was the one file
    // the check let past. (The .jpg half of this pair is
    // "records the extension's MIME type in preference to the browser's"
    // below, which posts the same value and asserts what was stored; a second
    // 201 here would only repeat the `it.each` row for .jpg.)
    const res = await post({ name: "setup.exe", type: "application/octet-stream" });
    expect(res.status).toBe(415);
  });
});

// ---------------------------------------------------------------------------
// Size, and the order of the two refusals
// ---------------------------------------------------------------------------

describe("the size limit is the one constant, and type is decided first", () => {
  it("accepts a file exactly at the limit", async () => {
    const res = await post({ name: "scan.jpg", size: MAX_UPLOAD_BYTES });
    expect(res.status).toBe(201);
  });

  it("refuses one byte over it", async () => {
    const res = await post({ name: "scan.jpg", size: MAX_UPLOAD_BYTES + 1 });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual(
      expect.objectContaining({ code: "file_too_large" }),
    );
  });

  it("tells an oversized .heic the thing about it that can be fixed", async () => {
    // ⚠️ The ordering is the whole assertion. Refusing a 30 MB HEIC burst for
    // its SIZE sends the user to rescan it at a lower resolution — advice that
    // cannot work, because the format is the problem. `AddPageDialog` orders
    // its two checks the same way.
    const res = await post({ name: "IMG_1.heic", size: MAX_UPLOAD_BYTES + 1 });
    expect(res.status).toBe(415);
  });

  it("refuses an empty file before anything else, even a refused format", async () => {
    // ⚠️ The name is a REFUSED one, which is what makes this about ORDER. With
    // an uploadable name the 400 proves only that the empty check runs at all;
    // with `.exe` it proves the empty check runs FIRST, because a reordering
    // would answer 415 here.
    expect((await post({ name: "setup.exe", size: 0 })).status).toBe(400);
    expect((await post({ name: "scan.jpg", size: 0 })).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// What gets recorded
// ---------------------------------------------------------------------------

describe("the recorded type and path come from the extension", () => {
  it("records the extension's MIME type in preference to the browser's", async () => {
    // The serving route derives what it SENDS from the stored path, so a row
    // recording something else disagrees with the bytes the viewer is handed —
    // and `application/octet-stream` is what a Windows-picked file arrives as.
    await post({ name: "scan.jpg", type: "application/octet-stream" });
    expect(queryMocks.createDocumentPage).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "image/jpeg" }),
    );
  });

  it("records the extension's type over a WRONG one the browser insisted on", async () => {
    // Not merely over a missing type: a browser that says `text/plain` about a
    // `.png` is still answering from the OS registry, not from the bytes.
    await post({ name: "scan.png", type: "text/plain" });
    expect(queryMocks.createDocumentPage).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "image/png" }),
    );
  });

  it("gives .bmp the type it went two slices without", async () => {
    await post({ name: "plan.bmp", type: "" });
    expect(queryMocks.createDocumentPage).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "image/bmp" }),
    );
  });

  it("stores the file under a lowercased extension", async () => {
    // `photo.JPG` used to be stored as `<uuid>.JPG`; the serving route reads
    // the extension back off the path, and its table is keyed lowercase.
    await post({ name: "photo.JPG" });
    const arg = queryMocks.createDocumentPage.mock.calls[0][0] as { filePath: string };
    expect(arg.filePath).toMatch(/\.jpg$/);
    expect(arg.filePath.startsWith(`document-pages/${DOC}/`)).toBe(true);
  });

  it("writes the BYTES to the same key and type it writes on the row", async () => {
    // ⚠️ The row and the object are two records of one fact, and until this
    // assertion existed nothing compared them: a route that stored the bytes
    // under a different key, or labelled the Supabase object with the browser's
    // type, left every page 404-ing or undrawable while the suite stayed green.
    // In production `uploadFile` passes this type STRAIGHT to Supabase, which
    // then serves it — so a disagreement here is a disagreement the user meets.
    await post({ name: "photo.JPG" });
    const row = queryMocks.createDocumentPage.mock.calls[0][0] as {
      filePath: string;
      mimeType: string;
    };
    expect(storageMocks.uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      row.filePath,
      row.mimeType,
    );
    expect(row.mimeType).toBe("image/jpeg");
  });
});

// ---------------------------------------------------------------------------
// The rest of the contract
// ---------------------------------------------------------------------------

describe("the route's other validations still hold", () => {
  it("rejects a page number that is not a positive integer", async () => {
    // Not #34.06's rule, but this file is the route's only behavioural guard
    // and an unexercised validator is a validator that can be deleted.
    for (const pageNumber of ["0", "-1", "2.5", "abc", ""]) {
      const fd = new FormData();
      fd.append("file", new File([new Uint8Array(4)], "scan.pdf"), "scan.pdf");
      fd.append("pageNumber", pageNumber);
      const req = new Request("http://localhost/api/documents/x/pages", {
        method: "POST",
        body: fd,
      }) as unknown as NextRequest;
      const res = await POST(req, { params: Promise.resolve({ id: DOC }) });
      expect(res.status).toBe(400);
    }
  });

  it("keeps the original file name on the row", async () => {
    await post({ name: "Act de vânzare.PDF" });
    expect(queryMocks.createDocumentPage).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "Act de vânzare.PDF" }),
    );
  });
});
