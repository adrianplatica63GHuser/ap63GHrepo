/**
 * @jest-environment node
 *
 * Slice 41.44 — „Cum lucrezi cu grupurile” / „Cum lucrezi cu ștampilele” name each button by its exact label, so every
 * label they quote must be a screen string of the same language, word for word. A label renamed on the screen and not
 * in the tile fails here, not in front of Ciprian.
 *
 * A quote matches a message whose whole text it is, or one it is with its count cut off — „‹ Include” for
 * „‹ Include ({count})”. The workflows' own messages are left out of the book, or every quote would match itself.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { WORKFLOW_STEPS } from "@/components/screen/workflows-tile";

type Tree = { [k: string]: string | Tree };
const read = (l: string) => JSON.parse(readFileSync(join(process.cwd(), "messages", `${l}.json`), "utf8")) as Tree;

function strings(t: Tree, skip: (path: string) => boolean, path = "", out: string[] = []): string[] {
  for (const [k, v] of Object.entries(t)) {
    const p = path ? `${path}.${k}` : k;
    if (skip(p)) continue;
    if (typeof v === "string") out.push(v);
    else strings(v, skip, p, out);
  }
  return out;
}

const COUNT = /\s*\(\{[a-z]+\}\)$/;

describe.each(["ro-RO", "en-GB"])("the workflows tiles in %s (41.44)", (locale) => {
  const messages = read(locale);
  const book = new Set(
    strings(messages, (p) => p === "group.workflows" || p === "stamp.workflows").flatMap((s) => [s, s.replace(COUNT, "")]),
  );

  it.each(["group", "stamp"])("%s: a title and the five workflows, each a heading and a body", (kind) => {
    const w = (messages[kind] as Tree).workflows as Tree;
    expect(typeof w.title).toBe("string");
    const steps = w.steps as Tree;
    expect(Object.keys(steps)).toEqual([...WORKFLOW_STEPS]);
    for (const k of WORKFLOW_STEPS) {
      const s = steps[k] as Tree;
      expect([k, typeof s.title, typeof s.body]).toEqual([k, "string", "string"]);
      // One to three sentences.
      const sentences = (s.body as string).split(/(?<=[.!?])\s+(?=[„A-ZĂÂÎȘȚ])/u).length;
      expect([k, sentences >= 1 && sentences <= 3]).toEqual([k, true]);
    }
  });

  it.each(["group", "stamp"])("%s: every label it quotes is a screen string, word for word", (kind) => {
    const w = (messages[kind] as Tree).workflows as Tree;
    const text = strings(w, () => false).join("\n");
    const quoted = [...text.matchAll(/„([^”]+)”/g)].map((m) => m[1]);
    expect(quoted.length).toBeGreaterThan(8);
    expect(quoted.filter((q) => !book.has(q))).toEqual([]);
  });
});
