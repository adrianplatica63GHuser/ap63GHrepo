/**
 * The dashboard's three day-count sentences follow their settings.
 *                                                                (Slice #32.18)
 *
 * THE DEFECT
 * ──────────
 * `dashboard.recentCounts.title` read "Added in the last 7 days",
 * `dashboard.expiringDocuments.empty` read "No documents expiring in the next
 * 60 days", and `dashboard.staleMetadata.description` interpolated only the
 * record count. Seven, sixty and ninety are exactly `TIME_FRAME_DEFAULTS` for
 * `dashboard_recent_days`, `dashboard_expiring_docs` and
 * `dashboard_stale_metadata`, which is why nobody noticed: on a fresh database
 * every sentence was true. Change one setting and the number under the heading
 * moves while the heading does not, and the reasonable conclusion — the one the
 * finding predicted somebody would reach — is that the save failed.
 *
 * WHAT IS ASSERTED, AND WHY IT IS RENDERED RATHER THAN READ
 * ─────────────────────────────────────────────────────────
 * A test that only checked the message file for a `{days}` placeholder would
 * pass on a component that still never passes one. A test that only spied on
 * `t` would pass on a message file somebody had reverted to a fixed string. So
 * each sentence is FORMATTED from the real `messages/*.json` and asserted as
 * text in the DOM, with the day-count set to something that is NOT the default
 * — the only value that can distinguish a wired sentence from a baked one.
 *
 * Both locales, because the Romanian is where this can go wrong quietly: 7 is
 * „7 zile" and 90 is „90 de zile", so a Romanian sentence that interpolates a
 * bare number is grammatical for one of them and wrong for the other. The
 * plural blocks are what make that correct, and `Intl.PluralRules("ro-RO")` is
 * what picks the branch here, as it does at runtime.
 *
 * ⚠️ WHY THERE IS A FORMATTER IN THIS FILE
 * ────────────────────────────────────────
 * next-intl cannot be loaded under Jest — it, `intl-messageformat` and
 * `@formatjs/*` are ESM-only with no CommonJS build and `next/jest` does not
 * transform `node_modules`. `src/test-support/icu.ts` explains this at length
 * and is the repo's answer for READING a message's structure. Nothing yet
 * FORMATS one, so this suite carries the ~40 lines that do, over the same ICU
 * subset `scanIcu` accepts — and it runs `scanIcu` over every message it
 * formats first, so a message that grew a feature the formatter does not
 * understand fails in the reviewed parser rather than being mis-rendered here.
 * `formatIcu` has its own tests below for the same reason.
 *
 * ⚠️ AND WHY next-intl IS MOCKED EVEN THOUGH NOTHING HERE CALLS IT
 * ────────────────────────────────────────────────────────────────
 * Importing the three sections evaluates `dashboard-client.tsx`, whose own
 * first import is `useTranslations` from next-intl — a VALUE import, kept by
 * SWC — and which reaches it a second way through <ScreenHelpButton> →
 * <HelpButton>. `next/jest` sets `transformIgnorePatterns` to everything under
 * node_modules except `geist`, and next-intl is `"type": "module"`, so without
 * the mock below this suite does not fail an assertion: it fails to LOAD, with
 * "Unexpected token 'export'" and the zero-failed-assertions summary
 * `jest.config.ts` warns about at length. Every source guard in the last block
 * would be dead and would look green-adjacent while testing nothing.
 *
 * The sections are imported directly rather than rendered through
 * <DashboardClient>, which would need a QueryClient, a router and two mocked
 * fetches on top. That the root actually threads the right setting into each of
 * them is the third block, read from source.
 */

import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { useTranslations } from "next-intl";
import {
  RecentCountsSection,
  ExpiringDocumentsSection,
  StaleMetadataSection,
} from "@/app/_components/dashboard-client";
import { TIME_FRAME_DEFAULTS } from "@/lib/time-frames/config";
import { scanIcu } from "@/test-support/icu";

// next-intl is ESM-only and is not transformed — see the header. Nothing here
// calls these; they exist so that importing the module under test succeeds.
jest.mock("next-intl", () => ({
  __esModule: true,
  useTranslations: () => (key: string) => key,
  useLocale: () => "en-GB",
}));

// <Link> needs an App Router context that jsdom has not got, and none of these
// assertions are about navigation. `createElement` rather than JSX because a
// `jest.mock` factory is hoisted above the file's imports, and JSX there would
// close over the injected jsx-runtime binding; `require` inside the factory is
// evaluated lazily and is explicitly allowed.
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("react") as typeof import("react")).createElement("a", null, children),
}));

const LOCALES = ["en-GB", "ro-RO"] as const;
type Locale = (typeof LOCALES)[number];

const MESSAGES: Record<Locale, Record<string, unknown>> = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "messages", `${l}.json`), "utf8"),
    ) as Record<string, unknown>,
  ]),
) as Record<Locale, Record<string, unknown>>;

/** `dashboard.recentCounts.title` -> the raw ICU string in that locale. */
function raw(locale: Locale, dottedKey: string): string {
  let node: unknown = MESSAGES[locale];
  for (const part of `dashboard.${dottedKey}`.split(".")) {
    node = (node as Record<string, unknown>)[part];
    if (node === undefined) throw new Error(`missing key: dashboard.${dottedKey} (${locale})`);
  }
  if (typeof node !== "string") throw new Error(`not a string: dashboard.${dottedKey}`);
  return node;
}

// ---------------------------------------------------------------------------
// A very small ICU formatter — simple placeholders and `plural` only
// ---------------------------------------------------------------------------

/** Index of the `}` matching the `{` at `open`. */
function matchBrace(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i;
  }
  throw new Error(`unbalanced braces in: ${s}`);
}

/** `one {a} few {b} other {c}` -> { one: "a", few: "b", other: "c" } */
function parseBranches(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    const brace = src.indexOf("{", i);
    if (brace === -1) throw new Error(`no branch body in: ${src}`);
    const category = src.slice(i, brace).trim();
    const end = matchBrace(src, brace);
    out[category] = src.slice(brace + 1, end);
    i = end + 1;
  }
  return out;
}

function formatIcu(
  message: string,
  values: Record<string, number | string>,
  locale: string,
): string {
  let out = "";
  let i = 0;
  while (i < message.length) {
    if (message[i] !== "{") { out += message[i]; i++; continue; }
    const end = matchBrace(message, i);
    const body = message.slice(i + 1, end);
    const comma = body.indexOf(",");
    if (comma === -1) {
      const name = body.trim();
      if (!(name in values)) throw new Error(`no value for {${name}}`);
      out += String(values[name]);
    } else {
      const arg = body.slice(0, comma).trim();
      const rest = body.slice(comma + 1).trimStart();
      if (!rest.startsWith("plural")) throw new Error(`unsupported ICU type in: ${body}`);
      if (!(arg in values)) throw new Error(`no value for {${arg}}`);
      const n = Number(values[arg]);
      const branches = parseBranches(rest.slice("plural".length).replace(/^\s*,\s*/, ""));
      const exact = `=${n}`;
      const category =
        exact in branches ? exact : new Intl.PluralRules(locale).select(n);
      const chosen = branches[category] ?? branches.other;
      if (chosen === undefined) throw new Error(`no branch for "${category}" in: ${body}`);
      out += formatIcu(chosen, values, locale).split("#").join(String(n));
    }
    i = end + 1;
  }
  return out;
}

/** A stand-in for next-intl's `t`, over one locale's `dashboard` namespace. */
function tFor(locale: Locale): ReturnType<typeof useTranslations> {
  const t = (key: string, values?: Record<string, number | string>) => {
    const message = raw(locale, key);
    scanIcu(message); // refuse anything formatIcu is not entitled to render
    return formatIcu(message, values ?? {}, locale);
  };
  return t as unknown as ReturnType<typeof useTranslations>;
}

// ---------------------------------------------------------------------------

describe("formatIcu (the harness itself)", () => {
  it("substitutes a simple placeholder", () => {
    expect(formatIcu("Expires in {days} days", { days: 3 }, "en-GB")).toBe("Expires in 3 days");
  });

  it("picks the English plural branch and renders #", () => {
    const m = "Added in the last {days, plural, one {day} other {# days}}";
    expect(formatIcu(m, { days: 1 }, "en-GB")).toBe("Added in the last day");
    expect(formatIcu(m, { days: 14 }, "en-GB")).toBe("Added in the last 14 days");
  });

  it("picks the Romanian few/other branches, which is where 'de' comes from", () => {
    const m = "{days, plural, one {o zi} few {# zile} other {# de zile}}";
    expect(formatIcu(m, { days: 1 }, "ro-RO")).toBe("o zi");
    expect(formatIcu(m, { days: 14 }, "ro-RO")).toBe("14 zile");
    expect(formatIcu(m, { days: 120 }, "ro-RO")).toBe("120 de zile");
  });
});

describe("the day-count sentences are not fixed strings", () => {
  const CASES = [
    ["recentCounts.title", "dashboard_recent_days"],
    ["expiringDocuments.empty", "dashboard_expiring_docs"],
    ["staleMetadata.description", "dashboard_stale_metadata"],
  ] as const;

  it.each(LOCALES)("%s: every sentence interpolates `days`", (locale) => {
    for (const [key] of CASES) {
      expect(scanIcu(raw(locale, key)).args.has("days")).toBe(true);
    }
  });

  it.each(LOCALES)("%s: no sentence still carries its default baked in", (locale) => {
    for (const [key, setting] of CASES) {
      const literal = String(TIME_FRAME_DEFAULTS[setting].value);
      expect(raw(locale, key)).not.toContain(literal);
    }
  });

  it.each(LOCALES)(
    "%s: the status column beside them counts in the same grammar",
    (locale) => {
      // `expiringDocuments.expiresInDays` renders in the same section as the
      // empty line above, for every document 2..`dashboard_expiring_docs` days
      // out. Romanian needs `de` above nineteen, so a bare {days} there says
      // „45 zile" directly under a corrected „...următoarele 60 de zile".
      // English's own sentence is invariant for every value it can be called
      // with (the 0 and 1 cases have their own keys), so it is left plain —
      // this test records that asymmetry rather than leaving it to be noticed.
      const message = raw(locale, "expiringDocuments.expiresInDays");
      expect(scanIcu(message).args.has("days")).toBe(true);
      if (locale === "ro-RO") {
        const block = scanIcu(message).plurals.find((p) => p.arg === "days");
        expect(block?.categories).toEqual(expect.arrayContaining(["few", "other"]));
        expect(formatIcu(message, { days: 5 }, locale)).toBe("Expiră în 5 zile");
        expect(formatIcu(message, { days: 45 }, locale)).toBe("Expiră în 45 de zile");
      }
    },
  );

  it.each(LOCALES)(
    "%s: `recentCounts.subtitle` no longer restates the window in words",
    (locale) => {
      // It used to say "New records since last week" / „...față de săptămâna
      // trecută", which is a second statement of `dashboard_recent_days` that
      // cannot take a placeholder. It is now window-free, so it cannot
      // contradict the title above it whatever the setting says.
      const subtitle = raw(locale, "recentCounts.subtitle");
      expect(subtitle).not.toMatch(/week|săptăm[âa]n/i);
      expect(scanIcu(subtitle).args.size).toBe(0);
    },
  );
});

describe("the rendered sentence follows the setting", () => {
  // Deliberately not the defaults (7 / 60 / 90): a baked sentence and a wired
  // one are indistinguishable at the default.
  const RECENT = 14;
  const EXPIRING = 45;
  const STALE = 120;

  it.each(LOCALES)("%s: the recent-counts heading quotes the recent-days window", (locale) => {
    render(
      <RecentCountsSection
        data={{ persons: 1, properties: 2, documents: 3 }}
        t={tFor(locale)}
        recentDays={RECENT}
      />,
    );
    const expected = formatIcu(raw(locale, "recentCounts.title"), { days: RECENT }, locale);
    expect(screen.getByText(expected)).toBeInTheDocument();
    // Read the DOM, not `expected`: this is what fails if the message is ever
    // reverted to a fixed string, which `getByText` alone would not catch.
    expect(screen.getByRole("heading").textContent).toContain(String(RECENT));
  });

  it.each(LOCALES)("%s: the empty expiring-documents line quotes its own window", (locale) => {
    render(
      <ExpiringDocumentsSection
        data={[]}
        t={tFor(locale)}
        amberDays={14}
        expiringDays={EXPIRING}
      />,
    );
    const expected = formatIcu(raw(locale, "expiringDocuments.empty"), { days: EXPIRING }, locale);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(document.body.textContent).toContain(String(EXPIRING));
  });

  it.each(LOCALES)("%s: the stale-metadata sentence quotes its age as well as its count", (locale) => {
    render(
      <StaleMetadataSection
        data={{ total: 5, persons: 0, properties: 0, documents: 0 }}
        t={tFor(locale)}
        staleDays={STALE}
      />,
    );
    const expected = formatIcu(
      raw(locale, "staleMetadata.description"),
      { total: 5, days: STALE },
      locale,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(document.body.textContent).toContain(String(STALE));
  });

  it("Romanian says 'de zile' above nineteen and plain 'zile' below it", () => {
    // The reason the Romanian messages carry a plural block at all. A bare
    // {days} would read „în ultimele 120 zile", which is wrong.
    const title = raw("ro-RO", "recentCounts.title");
    expect(formatIcu(title, { days: 14 }, "ro-RO")).toContain("14 zile");
    expect(formatIcu(title, { days: 120 }, "ro-RO")).toContain("120 de zile");
  });
});

describe("the root threads each setting into the section that quotes it", () => {
  /** Strip comments: a BEHAVIOUR guard must read only code. */
  const codeOnly = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  const SOURCE = codeOnly(
    fs.readFileSync(
      path.join(process.cwd(), "src", "app", "_components", "dashboard-client.tsx"),
      "utf8",
    ),
  );

  it.each([
    ["recentDays", "dashboard_recent_days"],
    ["staleDays", "dashboard_stale_metadata"],
    ["expiringDays", "dashboard_expiring_docs"],
  ])("%s comes from tfDays(tf, %s)", (prop, key) => {
    expect(SOURCE).toMatch(
      new RegExp(`${prop}=\\{tfDays\\(tf,\\s*"${key}"\\)\\}`),
    );
  });

  it("the sections are not reading useTimeFrames() for themselves", () => {
    // One call to the hook, in the root — the shape `amberDays` established.
    expect(SOURCE.match(/useTimeFrames\(\)/g)).toHaveLength(1);
  });
});
