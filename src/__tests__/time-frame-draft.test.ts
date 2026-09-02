/**
 * The Settings time-frame editor refuses `7.9` instead of storing `7`.
 *                                                                (Slice #32.18)
 *
 * THE DEFECT
 * ──────────
 * `handleSave` read each draft with `parseInt(raw, 10)`. `parseInt("7.9")` is
 * `7` — it stops at the dot and reports success — so the range check passed,
 * the PATCH body carried `7`, the server's `z.number().int()` was satisfied by
 * a value that had already been rounded for it, and the screen said "Saved
 * successfully." The user's `.9` was never rejected and never stored. This is
 * worse than a rejection precisely because nothing looks wrong.
 *
 * WHY THE RULE MOVED OUT OF THE COMPONENT
 * ───────────────────────────────────────
 * `handleSave` is a closure inside `TimeFramesPanel`, which imports next-intl
 * and cannot be mounted under Jest at all (`src/test-support/icu.ts` explains
 * why). Testing the rule therefore meant either not testing it or giving it a
 * name — so it is `parseTimeFrameDraft`, beside `TIME_FRAME_KEYS`, where the
 * two ends of the same rule can be read against each other. The component
 * keeps the messaging and the state; the parsing is what is asserted here.
 *
 * The last block reads `route.ts` because the point of the change is AGREEMENT
 * with the server, not strictness for its own sake: a client that refuses what
 * the server accepts is a different bug wearing the same clothes.
 */

import fs from "node:fs";
import path from "node:path";
import {
  parseTimeFrameDraft,
  TIME_FRAME_MIN,
  TIME_FRAME_MAX,
} from "@/lib/time-frames/config";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

/** Strip comments: a BEHAVIOUR guard must read only code. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("parseTimeFrameDraft", () => {
  it("refuses a fraction rather than truncating it — the finding, verbatim", () => {
    // The old line was `parseInt(raw, 10)`, and `parseInt("7.9")` is 7: not a
    // rejection, a truncation the user was never told about.
    expect(parseTimeFrameDraft("7.9")).toBeNull();
  });

  it.each(["7.0", "7.00", "7."])("accepts %s — a whole number written long", (raw) => {
    // `Number("7.")` is 7, and the server would take 7, so refusing it here
    // would be the client being stricter than the rule it exists to mirror.
    expect(parseTimeFrameDraft(raw)).toBe(7);
  });

  it.each(["7.5", "0.5", "-3", "0", "3651", "", "   ", "abc", "7d", ".", "NaN", "Infinity"])(
    "refuses %p",
    (raw) => {
      expect(parseTimeFrameDraft(raw)).toBeNull();
    },
  );

  it("accepts the ends of the range and refuses just outside them", () => {
    expect(parseTimeFrameDraft(String(TIME_FRAME_MIN))).toBe(TIME_FRAME_MIN);
    expect(parseTimeFrameDraft(String(TIME_FRAME_MAX))).toBe(TIME_FRAME_MAX);
    expect(parseTimeFrameDraft(String(TIME_FRAME_MIN - 1))).toBeNull();
    expect(parseTimeFrameDraft(String(TIME_FRAME_MAX + 1))).toBeNull();
  });

  it("tolerates surrounding whitespace, which a paste produces", () => {
    expect(parseTimeFrameDraft("  12  ")).toBe(12);
  });

  it("returns the number, not a truthy-checkable value — 0 is out of range anyway", () => {
    // Guards the call site's shape: `if (n === null)`, never `if (!n)`.
    expect(codeOnly(read("src", "app", "admin", "settings", "_components", "settings-view.tsx")))
      .toMatch(/const n = parseTimeFrameDraft\(raw\);\s*if \(n === null\)/);
  });
});

describe("the editor no longer parses the value itself", () => {
  const VIEW = codeOnly(
    read("src", "app", "admin", "settings", "_components", "settings-view.tsx"),
  );

  it("does not call parseInt anywhere", () => {
    expect(VIEW).not.toContain("parseInt");
  });

  it("still clears the three caches a saved value invalidates", () => {
    // Not decoration: the panel's own list is keyed ["time-frames-list"],
    // deliberately distinct from the shared hook's ["time-frames"], so a save
    // that invalidated only the latter left this very screen showing the
    // pre-save number under "Saved successfully." And the dashboard's counts
    // are computed server-side from these values, so its headings — which now
    // quote the settings — would sit over counts answering the old window.
    for (const key of ["time-frames", "time-frames-list", "dashboard"]) {
      expect(VIEW).toContain(`invalidateQueries({ queryKey: ["${key}"] })`);
    }
    // The drafts are cleared only after all three, because clearing them is
    // what makes an input fall back to the cache being refreshed.
    const lastInvalidate = VIEW.lastIndexOf("invalidateQueries");
    expect(VIEW.indexOf("setDrafts({})")).toBeGreaterThan(lastInvalidate);
  });

  it("does not re-declare the bounds it now imports", () => {
    // 1 and 3650 lived in three places (here, the input's min/max, and zod).
    // The literals stay on the <input> because HTML wants them there; what
    // must not come back is a second copy of the CHECK.
    expect(VIEW).not.toMatch(/n\s*<\s*1\s*\|\|\s*n\s*>\s*3650/);
  });
});

describe("the client's rule and the server's rule are the same rule", () => {
  it("the route still requires an integer in the same range", () => {
    const route = read("src", "app", "api", "time-frames", "route.ts");
    expect(route).toMatch(
      new RegExp(`z\\.number\\(\\)\\.int\\(\\)\\.min\\(${TIME_FRAME_MIN}\\)\\.max\\(${TIME_FRAME_MAX}\\)`),
    );
  });

  it("does not refuse what the server would take — the exponent form", () => {
    // A `<input type="number">` accepts "1e3", and so does
    // `z.number().int().min(1).max(3650)` once JSON.parse has turned it into
    // 1000. A client that refused it would be stricter than the rule it exists
    // to mirror, which is the opposite failure and just as wrong.
    expect(parseTimeFrameDraft("1e3")).toBe(1000);
  });
});

describe("the error message now refuses what the check now refuses", () => {
  it.each(["en-GB", "ro-RO"])("%s says whole numbers, not just numbers", (locale) => {
    const messages = JSON.parse(read("messages", `${locale}.json`)) as {
      settings: { timeFrames: { validationError: string } };
    };
    const text = messages.settings.timeFrames.validationError;
    expect(text).toMatch(locale === "en-GB" ? /whole numbers/ : /numere întregi/);
    expect(text).toContain(String(TIME_FRAME_MIN));
    expect(text).toContain(String(TIME_FRAME_MAX));
  });
});
