/**
 * src/test-support/icu.ts — a very small ICU message reader, for tests.
 * (Extracted from `import-structure-rules.test.ts` in Slice #26.05)
 *
 * WHY THE MESSAGE TESTS PARSE ICU RATHER THAN FORMATTING IT
 * ─────────────────────────────────────────────────────────
 *
 * The obvious test formats each sentence with `intl-messageformat`, which is
 * what next-intl uses at runtime. It cannot run here: `intl-messageformat`,
 * `@formatjs/*` and next-intl itself are all ESM-only with no CommonJS build,
 * and `next/jest` does not transform `node_modules`, so the import fails with
 * "Cannot use import statement outside a module". Making it work means adding
 * `transformIgnorePatterns` to `jest.config.ts` — a change to how every suite
 * is transformed, which no rules slice has been willing to make.
 *
 * So this reads the structure instead. It covers exactly the ICU subset these
 * messages use — simple placeholders and `plural` — and THROWS on anything
 * else, which is what keeps it honest: the day a message needs `select` or a
 * date skeleton, the suite fails rather than quietly under-checking it, and
 * that is the moment to reconsider the jest config.
 *
 * ⚠️ WHY IT IS NOT UNDER `src/__tests__/`
 * ───────────────────────────────────────
 *
 * Jest's default `testMatch` claims **every** file under a `__tests__` folder,
 * so a helper placed there is loaded as a suite and fails with "Your test suite
 * must contain at least one test". `src/test-support/` is outside that pattern
 * and outside the app's import graph — nothing in `src/app` or `src/lib` may
 * import from here.
 *
 * It moved out of the structure-rules suite because #26.05 added a second rule
 * catalogue with the same three-sentence shape, and a hand-written ICU parser
 * is precisely the kind of thing this codebase keeps single-source tests to
 * stop from existing twice. Its own tests stay in
 * `import-structure-rules.test.ts`, where they were written.
 */

export type IcuScan = {
  /** Every placeholder the message interpolates, at any nesting depth. */
  args: Set<string>;
  /** Every `plural` block, with the categories it declares. */
  plurals: { arg: string; categories: string[] }[];
};

/**
 * Read an ICU message's structure.
 *
 * The only thing that makes this safe to hand-write is that it REFUSES what it
 * does not understand. A regex that scrapes `{name` out of a message cannot
 * tell an argument from a plural branch — `one {gol}` would read as an
 * argument called "gol" — so this tracks position properly: a `{` in message
 * text opens an argument, and a `{` after a category name opens a branch whose
 * body is message text again.
 *
 * Throws on any ICU feature beyond a simple placeholder and `plural`.
 */
export function scanIcu(message: string): IcuScan {
  const args = new Set<string>();
  const plurals: { arg: string; categories: string[] }[] = [];
  const at = (i: number) => (i < message.length ? message[i] : "");
  const skipSpace = (i: number) => {
    while (/\s/.test(at(i))) i++;
    return i;
  };
  const fail = (i: number, what: string): never => {
    throw new Error(`${what} at ${i} in ${JSON.stringify(message)}`);
  };

  function scanMessage(from: number): number {
    let i = from;
    while (i < message.length) {
      const ch = message[i];
      if (ch === "}") return i;
      if (ch !== "{") {
        i++;
        continue;
      }
      i = scanArgument(i);
    }
    return i;
  }

  function scanArgument(start: number): number {
    let i = skipSpace(start + 1);
    const nameStart = i;
    while (/[A-Za-z0-9_]/.test(at(i))) i++;
    const name = message.slice(nameStart, i);
    if (name === "") fail(start, "empty placeholder");
    args.add(name);
    i = skipSpace(i);
    if (at(i) === "}") return i + 1;
    if (at(i) !== ",") fail(i, "unsupported placeholder syntax");
    i = skipSpace(i + 1);
    const typeStart = i;
    while (/[A-Za-z]/.test(at(i))) i++;
    const type = message.slice(typeStart, i);
    if (type !== "plural") fail(typeStart, `unsupported ICU type "${type}"`);
    i = skipSpace(i);
    if (at(i) !== ",") fail(i, "expected a comma after plural");
    i = skipSpace(i + 1);
    const categories: string[] = [];
    for (;;) {
      i = skipSpace(i);
      if (at(i) === "}") {
        i++;
        break;
      }
      if (i >= message.length) fail(i, "unterminated plural");
      const catStart = i;
      while (/[A-Za-z0-9=]/.test(at(i))) i++;
      const category = message.slice(catStart, i);
      if (category === "") fail(i, "expected a plural category");
      categories.push(category);
      i = skipSpace(i);
      if (at(i) !== "{") fail(i, "expected a plural branch");
      const end = scanMessage(i + 1);
      if (at(end) !== "}") fail(end, "unterminated plural branch");
      i = end + 1;
    }
    plurals.push({ arg: name, categories });
    return i;
  }

  const consumed = scanMessage(0);
  if (consumed !== message.length) fail(consumed, "unbalanced brace");
  return { args, plurals };
}
