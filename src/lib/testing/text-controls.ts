/**
 * Every control in the app that shows WORDS rather than an icon.   (Slice #37.48)
 *
 * #37.42–#37.47 moved the app's buttons onto IconButton, keeping words only
 * where Adrian decided they stay (GA40-CTA-Icon-Map.xlsx, „Keep text"). This
 * reads the source the way the workbook's sweep did — every `<button>`, `<a>`,
 * `<Link>` and `role="button"` element under `src/` outside the tests — and
 * returns the ones whose children carry visible text. `text-controls-guard`
 * holds them against a named list, so a new text button is a decision someone
 * makes in the diff, not a drift nobody saw.
 *
 * ⚠️ **A READING OF THE SOURCE, NOT OF THE PAGE.** It is a string scan, kept
 * deliberately simple, and its `key` — the element's children, comments
 * removed and whitespace collapsed — is only ever compared with keys it
 * produced itself. What it counts as "no visible text": children that are
 * nothing but tags (an icon component, an `<img>`). A text link that carries
 * its icon through `LeadingIcon` / `TrailingIcon` (#37.46, #37.47) is counted
 * as having its icon, and is not returned.
 */
import fs from "fs";
import path from "path";

export interface TextControl {
  /** Repository-relative path, forward slashes. */
  file: string;
  line: number;
  tag: string;
  /** The children, `{/* … *\/}` comments removed and whitespace collapsed. */
  key: string;
}

/** The index of the `>` that closes the opening tag starting at `from`, and whether it is `/>`. */
function openingEnd(s: string, from: number): { end: number; selfClosing: boolean } | null {
  let depth = 0;
  let quote: string | null = null;
  for (let j = from; j < s.length; j++) {
    const c = s[j];
    if (quote) {
      if (c === quote && s[j - 1] !== "\\") quote = null;
    } else if ((c === '"' || c === "'" || c === "`") && depth > 0) {
      quote = c;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
    } else if (c === ">" && depth === 0) {
      return { end: j, selfClosing: s[j - 1] === "/" };
    }
  }
  return null;
}

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      walk(p, out);
    } else if (entry.name.endsWith(".tsx")) {
      out.push(p);
    }
  }
}

export function scanTextControls(root: string): TextControl[] {
  const files: string[] = [];
  walk(path.join(root, "src"), files);
  const found: TextControl[] = [];
  for (const abs of files.sort()) {
    const s = fs.readFileSync(abs, "utf8");
    const file = path.relative(root, abs).split(path.sep).join("/");
    // Block comments, JSX's `{/* … */}` among them: a control written out in
    // a comment („"Alege alt folder…" STOOD HERE UNTIL #32.04") is not one.
    const comments: [number, number][] = [];
    for (const c of s.matchAll(/\/\*[\s\S]*?\*\//g)) comments.push([c.index ?? 0, (c.index ?? 0) + c[0].length]);
    const inComment = (i: number) => comments.some(([from, to]) => i >= from && i < to);
    const re = /<(button|a|Link)(?=[\s>])|role="button"/g;
    for (let m = re.exec(s); m; m = re.exec(s)) {
      if (inComment(m.index)) continue;
      let tag: string;
      let start: number;
      if (m[0] === 'role="button"') {
        start = s.lastIndexOf("<", m.index);
        const t = /^<(\w+)/.exec(s.slice(start));
        if (!t || t[1] === "button" || t[1] === "a" || t[1] === "Link") continue;
        tag = t[1];
      } else {
        tag = m[1];
        start = m.index;
      }
      const lineStart = s.lastIndexOf("\n", start) + 1;
      const before = s.slice(lineStart, start).trim();
      if (before.startsWith("//") || before.startsWith("*") || before.startsWith("/*")) continue;
      const open = openingEnd(s, start + 1);
      if (!open || open.selfClosing) continue;
      const close = s.indexOf(`</${tag}>`, open.end);
      if (close < 0) continue;
      const children = s
        .slice(open.end + 1, close)
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .join(" ");
      if (/<(LeadingIcon|TrailingIcon)\b/.test(children)) continue;
      const visible = children.replace(/<\/?[A-Za-z][^<>]*?>/g, "").trim();
      if (visible === "") continue;
      found.push({ file, line: s.slice(0, start).split("\n").length, tag, key: children });
    }
  }
  return found;
}
