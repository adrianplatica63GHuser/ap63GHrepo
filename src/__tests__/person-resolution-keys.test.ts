/**
 * Slice #23.01.Import — i18n contract for the shared confirm-or-create dialog.
 *
 * PersonResolutionDialog takes its translator from whichever caller mounts it,
 * so it cannot type-check its own keys: `document.aiPartyLinker` and
 * `adminImport.wizard.importDialog.idCard` are two independent namespaces that
 * both have to supply the full RESOLUTION_KEYS set, in both locales.
 *
 * Without this test a missing key is invisible until someone opens the dialog
 * in production and reads a raw key name back — which is exactly how the
 * bulk-delete confirm dialog shipped broken on both person lists (it called
 * tBulk("title") against a block that defines confirmTitle) and stayed broken
 * from Slice 15.03 until Slice #23.01.Import found it.
 *
 * Romanian is the locale that matters — every user of this system is Romanian
 * and must never see an untranslated string — so ro-RO is checked exactly as
 * strictly as en-GB, and both are checked for blank values, not just presence.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { RESOLUTION_KEYS } from "@/components/persons/person-resolution-dialog";

const LOCALES = ["ro-RO", "en-GB"] as const;

/** Every namespace that mounts PersonResolutionDialog. */
const NAMESPACES = [
  "document.aiPartyLinker",
  "adminImport.wizard.importDialog.idCard",
] as const;

type Messages = Record<string, unknown>;

function loadMessages(locale: string): Messages {
  const file = path.join(process.cwd(), "messages", `${locale}.json`);
  return JSON.parse(readFileSync(file, "utf-8")) as Messages;
}

/**
 * Walks a dotted namespace path, returning the object at the end of it.
 *
 * Throws rather than using expect(): this runs at describe-collection time,
 * outside any test, where a failed matcher would surface as an opaque suite
 * error instead of naming the missing namespace.
 */
function resolveNamespace(messages: Messages, namespace: string): Messages {
  let node: unknown = messages;
  const walked: string[] = [];
  for (const segment of namespace.split(".")) {
    if (typeof node !== "object" || node === null) {
      throw new Error(`Not an object at "${walked.join(".")}" while resolving "${namespace}"`);
    }
    node = (node as Messages)[segment];
    walked.push(segment);
    if (node === undefined) {
      throw new Error(`Missing i18n namespace "${walked.join(".")}" (resolving "${namespace}")`);
    }
  }
  return node as Messages;
}

describe("PersonResolutionDialog i18n contract", () => {
  it("declares a non-empty key set", () => {
    expect(RESOLUTION_KEYS.length).toBeGreaterThan(0);
    expect(new Set(RESOLUTION_KEYS).size).toBe(RESOLUTION_KEYS.length);
  });

  describe.each(LOCALES)("%s", (locale) => {
    const messages = loadMessages(locale);

    describe.each(NAMESPACES)("%s", (namespace) => {
      const block = resolveNamespace(messages, namespace);

      it.each(RESOLUTION_KEYS)("defines %s as a non-empty string", (key) => {
        const value = block[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim()).not.toBe("");
      });
    });
  });
});

describe("placeholder parity", () => {
  // A branch that interpolates in one namespace but not the other renders a
  // literal "{roleName}" at the user in whichever one forgot it.
  const WITH_PLACEHOLDERS: Record<string, string[]> = {
    subtitle: ["current", "total"],
    roleMissingBody: ["roleName"],
  };

  describe.each(LOCALES)("%s", (locale) => {
    const messages = loadMessages(locale);

    describe.each(NAMESPACES)("%s", (namespace) => {
      const block = resolveNamespace(messages, namespace);

      it.each(Object.entries(WITH_PLACEHOLDERS))(
        "%s interpolates every expected placeholder",
        (key, placeholders) => {
          const value = block[key] as string;
          for (const name of placeholders) {
            expect(value).toContain(`{${name}}`);
          }
        },
      );
    });
  });
});
