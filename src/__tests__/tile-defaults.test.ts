/**
 * Slice #38.41 — a user's own default tiles, read against a registry as it is today.
 */

import type { TileRegistry } from "@/lib/ui/tiles";
import {
  DOCUMENT_BUILT_IN_DEFAULTS,
  DOCUMENT_COMMON_TILES,
  effectiveDefaults,
  kindOfEntity,
  savedDefaultsFor,
} from "@/lib/ui/tile-defaults";

const person: TileRegistry<string> = {
  entity: "natural-person",
  all: ["identity", "idCard", "contact", "related", "classification"],
  defaults: ["identity", "idCard"],
  form: ["identity", "idCard", "contact"],
  renamed: { metadata: ["classification"], card: "idCard" },
};

/** A certificate-like type: two notebook pages, „Părți", and the page image. */
const certificate: TileRegistry<string> = {
  entity: "document-CERTIFICAT_MOSTENITOR",
  all: ["general", "tab-a", "tab-b", "succession", "related", "classification", "connections", "pages"],
  defaults: ["general", "pages", "tab-a", "succession"],
  form: ["general", "pages", "tab-a", "tab-b", "succession"],
};

/** A type with no notebook: its own tile is „fields" itself. */
const plain: TileRegistry<string> = {
  entity: "document-PROCURA",
  all: ["general", "fields", "related", "classification", "connections"],
  defaults: ["general", "fields"],
  form: ["general", "fields"],
};

describe("kindOfEntity", () => {
  it("reads every document type as a document, and the dashboard as no kind", () => {
    expect(kindOfEntity("document-CONTRACT_VANZARE")).toBe("document");
    expect(kindOfEntity("natural-person")).toBe("natural-person");
    expect(kindOfEntity("property")).toBe("property");
    expect(kindOfEntity("dashboard")).toBeNull();
  });
});

describe("savedDefaultsFor", () => {
  it("is null when nothing is saved, or the saved value is not a list", () => {
    expect(savedDefaultsFor(person, undefined)).toBeNull();
    expect(savedDefaultsFor(person, "identity")).toBeNull();
    expect(savedDefaultsFor(person, [])).toBeNull();
  });

  it("returns the saved tiles in the registry's order", () => {
    expect(savedDefaultsFor(person, ["related", "identity"])).toEqual(["identity", "related"]);
  });

  it("reads a renamed tile as its new key — one or several", () => {
    expect(savedDefaultsFor(person, ["card"])).toEqual(["idCard"]);
    expect(savedDefaultsFor(person, ["metadata", "identity"])).toEqual(["identity", "classification"]);
  });

  it("drops a tile the registry no longer has, and is null when nothing is left", () => {
    expect(savedDefaultsFor(person, ["identity", "gone"])).toEqual(["identity"]);
    expect(savedDefaultsFor(person, ["gone", 3])).toBeNull();
  });

  it("reads „fields” on a document type with a notebook as the type's own default tiles", () => {
    expect(savedDefaultsFor(certificate, ["general", "fields"])).toEqual(["general", "tab-a", "succession"]);
    expect(savedDefaultsFor(certificate, ["fields", "related"])).toEqual(["tab-a", "succession", "related"]);
  });

  it("reads „fields” on a type with no notebook as „fields” itself", () => {
    expect(savedDefaultsFor(plain, ["general", "fields"])).toEqual(["general", "fields"]);
  });

  it("drops „pages” on a type that has no page image", () => {
    expect(savedDefaultsFor(plain, ["pages", "general"])).toEqual(["general"]);
  });

  it("never reads „fields” as anything on a record that is not a document", () => {
    expect(savedDefaultsFor(person, ["fields"])).toBeNull();
  });
});

describe("effectiveDefaults", () => {
  it("is the registry's own set when nothing usable is saved", () => {
    expect(effectiveDefaults(person, undefined)).toEqual(["identity", "idCard"]);
    expect(effectiveDefaults(person, ["gone"])).toEqual(["identity", "idCard"]);
  });

  it("is the saved set when there is one", () => {
    expect(effectiveDefaults(person, ["contact"])).toEqual(["contact"]);
  });
});

describe("the document row in „Contul meu”", () => {
  it("offers only the tiles every type has, and ticks a subset of them by default", () => {
    for (const k of DOCUMENT_BUILT_IN_DEFAULTS) expect(DOCUMENT_COMMON_TILES).toContain(k);
  });

  it("gives back today's built-in set on a certificate when the built-in row is saved as is", () => {
    // The same tiles as the certificate's own `defaults`, in the registry's order.
    expect(savedDefaultsFor(certificate, [...DOCUMENT_BUILT_IN_DEFAULTS])).toEqual(["general", "tab-a", "succession", "pages"]);
  });
});
