/**
 * @jest-environment node
 */

/**
 * Slice Propus.3.q1 (FU-115) — the two message files hold the same keys.
 *
 * ⚠️ **ROMANIAN IS THE SHIPPING LOCALE, AND A MISSING KEY IS NOT AN ERROR AT
 * RUNTIME.** next-intl renders a key it cannot find as its own path —
 * `document.tabs.persons` where „Persoane" should be — so a key added to
 * `en-GB.json` and forgotten in `ro-RO.json` reaches Ciprian as a string of
 * dots, and neither `tsc` nor ESLint can see it. The per-namespace copy suites
 * (`import-*-copy`, `doc-type-engine-copy`, …) check the keys THEIR component
 * asks for; this suite checks the two files against each other, whole.
 *
 * On a failure it names every missing key on each side, so the fix is a list,
 * not a search.
 *
 * It does not check that an English value is English (FU-071), nor plural arms
 * or interpolation arguments — those are the copy suites'.
 */

import fs from "fs";
import path from "path";

type Leaf = { key: string; kind: string };

function leaves(value: unknown, prefix = "", out: Leaf[] = []): Leaf[] {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    // An empty namespace has no leaves to compare, so it would pass the key check silently.
    if (entries.length === 0 && prefix) out.push({ key: prefix, kind: "empty object" });
    for (const [k, v] of entries) {
      leaves(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    out.push({ key: prefix, kind: Array.isArray(value) ? "array" : value === null ? "null" : typeof value });
  }
  return out;
}

function load(file: string): Leaf[] {
  const text = fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8");
  return leaves(JSON.parse(text.replace(/^﻿/, "")));
}

const ro = load("ro-RO.json");
const en = load("en-GB.json");

describe("messages/ro-RO.json and messages/en-GB.json hold the same keys", () => {
  it("both files have keys at all — an empty parse would make every comparison below pass", () => {
    expect(ro.length).toBeGreaterThan(1000);
    expect(en.length).toBeGreaterThan(1000);
  });

  it("every key in English is in Romanian, and every key in Romanian is in English", () => {
    const roKeys = new Set(ro.map((l) => l.key));
    const enKeys = new Set(en.map((l) => l.key));
    expect({
      missingFromRomanian: [...enKeys].filter((k) => !roKeys.has(k)).sort(),
      missingFromEnglish: [...roKeys].filter((k) => !enKeys.has(k)).sort(),
    }).toEqual({ missingFromRomanian: [], missingFromEnglish: [] });
  });

  it("every value is a string — a number, an array or an empty object renders as nothing useful", () => {
    const notStrings = (ls: Leaf[]): string[] => ls.filter((l) => l.kind !== "string").map((l) => `${l.key} (${l.kind})`);
    expect({ romanian: notStrings(ro), english: notStrings(en) }).toEqual({ romanian: [], english: [] });
  });

  it("an empty object is caught as a leaf, not skipped", () => {
    expect(leaves({ a: {} })).toEqual([{ key: "a", kind: "empty object" }]);
    expect(leaves({ a: { b: "x" }, c: [1] })).toEqual([
      { key: "a.b", kind: "string" },
      { key: "c", kind: "array" },
    ]);
  });
});
