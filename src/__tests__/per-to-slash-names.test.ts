/**
 * Every „per” that stands for a slash, in the values the import takes from a
 * folder or file name                                           (Slice #37.39)
 *
 * perToSlash's own rule is in folder-utils.test.ts. This suite is where the
 * rule reaches: the nickname a folder gives a Property, the title a file gives
 * a document, the tags, a re-import that must still find what it imported, and
 * the search.
 */

const mockTx = {
  execute: jest.fn().mockResolvedValue(undefined),
  select: jest.fn(() => ({
    from: () => ({ where: () => ({ limit: async () => [{ indicativ: "47/2" }] }) }),
  })),
};

jest.mock("@/db", () => ({
  __esModule: true,
  db: { transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mockTx)) },
}));

jest.mock("@/lib/metadata/queries", () => ({
  __esModule: true,
  setInitialProvenance: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/properties/queries", () => ({
  __esModule: true,
  createPropertyIn: jest.fn(),
  findPropertiesByCadastralIdentity: jest.fn(),
  updatePropertyIn: jest.fn(),
}));

import { nameValue, tagsForEntry, type FSEntry } from "@/lib/import/folder-utils";
import {
  matchArchiveDocuments,
  preexistingKeyOf,
  titleForEntry,
  type ArchivePageRow,
} from "@/lib/import/preexisting-check";
import { normaliseTag } from "@/lib/import/reconcile";
import { cadastralKey } from "@/lib/properties/cadastral-identity";
import { ensurePropertyForFolder } from "@/lib/properties/import-property";
import * as queries from "@/lib/properties/queries";
import { perSearchTerms } from "@/lib/search/per-terms";

const mocks = queries as unknown as {
  createPropertyIn: jest.Mock;
  findPropertiesByCadastralIdentity: jest.Mock;
};

function file(name: string, pathParts: string[] = []): FSEntry {
  return {
    kind: "file",
    name,
    path: [...pathParts, name].join("/"),
    pathParts,
    handle: {} as never,
  } as unknown as FSEntry;
}

beforeEach(() => jest.clearAllMocks());

describe("nameValue — a value taken from a name", () => {
  it("decodes, trims, and is null when nothing is left", () => {
    expect(nameValue("Tarla 47per2")).toBe("Tarla 47/2");
    expect(nameValue("  T47 per P2  ")).toBe("T47/P2");
    expect(nameValue("Perdea")).toBe("Perdea");
    expect(nameValue("   ")).toBeNull();
    expect(nameValue(null)).toBeNull();
    expect(nameValue(undefined)).toBeNull();
  });
});

describe("the nickname a folder gives a Property", () => {
  const created = (nickname: string | null) => ({
    property: {
      id: "p1",
      code: "PROP00001",
      nickname,
      principalObjectId: "po1",
      tarlaId: "t1",
      parcela: "225/3",
    },
    corners: [],
  });

  it("„Tarla 47per2” is stored as „Tarla 47/2”, beside a decoded tarla and parcela", async () => {
    mocks.findPropertiesByCadastralIdentity.mockResolvedValue([]);
    mocks.createPropertyIn.mockImplementation(async (_tx: unknown, input: { nickname: string | null }) =>
      created(input.nickname),
    );
    const out = await ensurePropertyForFolder({ tarlaSola: "47per2", parcela: "225 per 3", nickname: "Tarla 47per2" });
    expect(mocks.createPropertyIn).toHaveBeenCalledTimes(1);
    const input = mocks.createPropertyIn.mock.calls[0][1];
    expect(input).toMatchObject({ nickname: "Tarla 47/2", tarlaCode: "47/2", parcela: "225/3" });
    expect(out.outcome).toBe("created");
  });

  it("a re-import of the same folder finds the Property and creates nothing", async () => {
    // The archive holds the decoded values; the folder on disk still says `per`.
    mocks.findPropertiesByCadastralIdentity.mockResolvedValue([
      {
        id: "p1",
        code: "PROP00001",
        nickname: "T47/P2-5",
        principalObjectId: "po1",
        tarla: "T47/P2",
        parcela: "5",
        cornerCount: 4,
      },
    ]);
    const out = await ensurePropertyForFolder({ tarlaSola: "T47 per P2", parcela: "5", nickname: "T47 per P2-5" });
    expect(mocks.findPropertiesByCadastralIdentity).toHaveBeenCalledWith(expect.anything(), "T47/P2", "5");
    expect(mocks.createPropertyIn).not.toHaveBeenCalled();
    expect(out.outcome).not.toBe("created");
  });

  it("the cadastral key is the same for the folder's spelling and the stored one", () => {
    expect(cadastralKey("T47 per P2")).toBe(cadastralKey("T47/P2"));
    expect(cadastralKey("T47perP2")).toBe(cadastralKey("t47/p2"));
    expect(cadastralKey("Super 2")).not.toBe(cadastralKey("Su/2"));
  });
});

describe("the title a file gives a document, and the tags its folders give it", () => {
  it("a „per” in the file's name is a slash in the title; the path keeps the name on disk", () => {
    const e = file("Plan lot 5per3.jpg", ["47per2-225"]);
    expect(titleForEntry(e)).toBe("Plan lot 5/3.jpg");
    expect(e.path).toBe("47per2-225/Plan lot 5per3.jpg");
    expect(titleForEntry(file("Supermarket.pdf"))).toBe("Supermarket.pdf");
  });

  it("a page-group's title hint is decoded too", () => {
    const g = { kind: "page-group", name: "47per2 act", titleHint: "Act 47per2", path: "x", pathParts: [], handles: [] };
    expect(titleForEntry(g as unknown as FSEntry)).toBe("Act 47/2");
  });

  it("tags are the folders' names, decoded; a tag compares the same either way", () => {
    expect(tagsForEntry("Arhiva 2024", file("a.pdf", ["47per2-225per3", "Perdea"]))).toEqual([
      "Arhiva 2024",
      "47/2-225/3",
      "Perdea",
    ]);
    expect(normaliseTag("47per2-225per3")).toBe(normaliseTag("47/2-225/3"));
  });
});

describe("a re-import still finds the document it imported", () => {
  const files = [{ name: "Plan lot 5per3.jpg", size: 1234 }];
  const row = (title: string): ArchivePageRow => ({
    documentId: "d1",
    fileName: "Plan lot 5per3.jpg",
    fileSize: 1234,
    code: "DOC00001",
    title,
    importTitle: title,
    createdAt: new Date("2026-09-01T00:00:00Z"),
  });
  const candidate = { path: "Plan lot 5per3.jpg", title: titleForEntry(file("Plan lot 5per3.jpg")), files };

  it("keys the folder's spelling and the stored one alike", () => {
    expect(preexistingKeyOf("Plan lot 5per3.jpg", files)).toBe(preexistingKeyOf("Plan lot 5/3.jpg", files));
  });

  it.each([
    ["stored after migration_089", "Plan lot 5/3.jpg"],
    ["stored before it, or left alone by it", "Plan lot 5per3.jpg"],
  ])("matches a document %s", (_label, stored) => {
    const matches = matchArchiveDocuments([row(stored)], [candidate]);
    expect(matches.map((m) => m.documentId)).toEqual(["d1"]);
  });
});

describe("search — the term as typed, and decoded", () => {
  it("asks for both forms when they differ, one when they do not", () => {
    expect(perSearchTerms("47per2")).toEqual(["47per2", "47/2"]);
    expect(perSearchTerms(" T47 per P2 ")).toEqual(["T47 per P2", "T47/P2"]);
    expect(perSearchTerms("47/2")).toEqual(["47/2"]);
    expect(perSearchTerms("Perdea")).toEqual(["Perdea"]);
    expect(perSearchTerms("  ")).toEqual([]);
    expect(perSearchTerms(null)).toEqual([]);
  });
});
