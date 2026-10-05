/**
 * A new document's pages, chosen before its first save.          (Slice #37.93)
 *
 * The save is the document first, then its pages in the order chosen,
 * numbered from 1; a page that fails is named and the rest are still tried;
 * a document that is not created uploads nothing. A file is refused before
 * Save by the same two checks as „+ Adaugă pagină".
 */
import fs from "node:fs";
import path from "node:path";
import {
  movePage,
  pageRefusal,
  rememberUnsavedPages,
  saveNewDocument,
  takeUnsavedPages,
  type StagedPage,
} from "@/lib/documents/new-document-pages";
import { MAX_UPLOAD_BYTES } from "@/lib/import/constraint-rules";

const staged = (...names: string[]): StagedPage[] =>
  names.map((name, i) => ({ key: `k${i}`, file: new File(["x"], name) }));

describe("the save's order (#37.93)", () => {
  it("creates the document first, then uploads every page in order, numbered from 1", async () => {
    const calls: string[] = [];
    const result = await saveNewDocument(
      staged("a.jpg", "b.jpg", "c.pdf"),
      async () => {
        calls.push("create");
        return "doc-1";
      },
      async (id, file, n) => {
        calls.push(`${id}:${n}:${file.name}`);
        return true;
      },
    );
    expect(calls).toEqual(["create", "doc-1:1:a.jpg", "doc-1:2:b.jpg", "doc-1:3:c.pdf"]);
    expect(result).toEqual({ ok: true, id: "doc-1", unsaved: [] });
  });

  it("uploads nothing when the document is not created", async () => {
    const upload = jest.fn(async () => true);
    const result = await saveNewDocument(staged("a.jpg"), async () => null, upload);
    expect(result).toEqual({ ok: false });
    expect(upload).not.toHaveBeenCalled();
  });

  it("names a page that failed — refused or thrown — and still tries the next", async () => {
    const tried: number[] = [];
    const result = await saveNewDocument(
      staged("a.jpg", "b.jpg", "c.pdf"),
      async () => "doc-2",
      async (_id, file, n) => {
        tried.push(n);
        if (file.name === "a.jpg") return false;
        if (file.name === "c.pdf") throw new Error("network");
        return true;
      },
    );
    expect(tried).toEqual([1, 2, 3]);
    expect(result).toEqual({ ok: true, id: "doc-2", unsaved: ["a.jpg", "c.pdf"] });
  });

  it("saves a document with no pages as before", async () => {
    const upload = jest.fn(async () => true);
    expect(await saveNewDocument([], async () => "doc-3", upload)).toEqual({ ok: true, id: "doc-3", unsaved: [] });
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("a file refused before Save (#37.93)", () => {
  it('is refused for its type before its size, as „+ Adaugă pagină" refuses it', () => {
    expect(pageRefusal({ name: "scan.jpg", size: 1000 })).toBeNull();
    expect(pageRefusal({ name: "act.pdf", size: 1000 })).toBeNull();
    expect(pageRefusal({ name: "poza.heic", size: MAX_UPLOAD_BYTES + 1 })).toBe("fileTypeNotAllowed");
    expect(pageRefusal({ name: "scan.jpg", size: MAX_UPLOAD_BYTES + 1 })).toBe("fileTooLarge");
  });

  it("is one rule for both doors: the saved document's dialog asks pageRefusal too", () => {
    const panel = fs.readFileSync(path.join(process.cwd(), "src/app/documents/_components/pages-panel.tsx"), "utf8");
    expect(panel).toContain("pageRefusal(file)");
    const staging = fs.readFileSync(path.join(process.cwd(), "src/app/documents/_components/new-pages-panel.tsx"), "utf8");
    expect(staging).toContain("pageRefusal(file)");
    expect(staging).toContain("accept={UPLOAD_ACCEPT_ATTRIBUTE}");
  });
});

describe("the order chosen (#37.93)", () => {
  it("moves a page one place up or down, the ends staying put", () => {
    expect(movePage(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(movePage(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(movePage(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(movePage(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
});

describe("the pages a save could not upload (#37.93)", () => {
  const store = new Map<string, string>();
  beforeAll(() => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });

  it("are named once on the document's screen, then forgotten", () => {
    rememberUnsavedPages("doc-9", ["b.jpg"]);
    expect(takeUnsavedPages("doc-9")).toEqual(["b.jpg"]);
    expect(takeUnsavedPages("doc-9")).toEqual([]);
  });

  it("leave nothing behind when every page arrived", () => {
    rememberUnsavedPages("doc-10", []);
    expect(takeUnsavedPages("doc-10")).toEqual([]);
  });

  it("never stop a save when the browser refuses storage", () => {
    const refusing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: refusing });
    expect(() => rememberUnsavedPages("doc-11", ["a.jpg"])).not.toThrow();
    expect(takeUnsavedPages("doc-11")).toEqual([]);
  });
});
