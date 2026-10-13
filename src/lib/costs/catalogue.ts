/**
 * src/lib/costs/catalogue.ts                                       (Slice #39.17)
 *
 * Every provider that can cost the business money, as „Setări → Costuri" shows
 * it: one tile each. What the tile SAYS (conditions, free tier, how pricing
 * works) is in `messages/*.json` → `settings.costs.providers.<key>`; what is
 * here is what is not prose — the provider's own pricing page, the day its
 * prices were last checked there, how its figures reach the tile, and the key
 * that would connect it.
 *
 * ⚠️ **PRICES CHANGE.** Every price on a tile carries `checked` and `pricingUrl`.
 * When a price is re-checked, change the message AND the date here, together.
 *
 * Pure: no I/O, so `src/__tests__/settings-costs.test.ts` holds all of it.
 */

export const COST_PROVIDERS = [
  "ai",
  "claudePlan",
  "googleMaps",
  "streetView",
  "addressLookups",
  "supabase",
  "vercel",
  "resend",
  "github",
  "domain",
  "testing",
] as const;
export type CostProvider = (typeof COST_PROVIDERS)[number];

/** The `cost_record.provider` value of each tile — lower-case, hyphenated (migration_107's check). */
export const PROVIDER_ID: Readonly<Record<CostProvider, string>> = {
  ai: "anthropic-api",
  claudePlan: "claude-plan",
  googleMaps: "google-maps",
  streetView: "google-street-view",
  addressLookups: "google-geocoding",
  supabase: "supabase",
  vercel: "vercel",
  resend: "resend",
  github: "github",
  domain: "domain",
  testing: "testing",
};

/**
 * How a tile's figures reach it.
 *   counted  — worked out from the application's own count (paid AI reads).
 *   entered  — typed in by Adrian from a bill or a price list.
 *   known    — a bill's figures already read by a slice (Google, Oct 8–11), plus what Adrian enters.
 *   estimated — nothing billed yet: the month's use is the tests' count plus an estimate of people's, set against the
 *              free allowance; any bill line is entered by Adrian (Google's Street View and address look-ups, #39.19).
 */
export type CostSource = "counted" | "entered" | "known" | "estimated";

export interface ProviderFacts {
  pricingUrl: string;
  /** The day the prices on the tile were read on `pricingUrl`. */
  checked: string;
  /** The currency the provider bills in. */
  currency: "CAD" | "USD" | "EUR";
  source: CostSource;
  /**
   * The `.env` key that would connect the provider's own billing figures, and
   * where Adrian gets it — or null when there is nothing to connect.
   */
  liveKey: { name: string; where: string } | null;
}

export const PRICES_CHECKED = "2026-10-12";
/** Street View's and the address look-up's prices, read on Google's page for Slice #39.19. */
export const GOOGLE_EXTRAS_CHECKED = "2026-10-13";

/** The Google key line the maps' tile shows — the same billing export covers all three of Google's charges. */
const GOOGLE_BILLING_KEY = {
  name: "GOOGLE_BILLING_EXPORT_TABLE",
  where: "Google Cloud → Billing → Billing export → BigQuery export (the table's name), with a service account that may read it (GOOGLE_APPLICATION_CREDENTIALS)",
};

export const PROVIDER_FACTS: Readonly<Record<CostProvider, ProviderFacts>> = {
  ai: {
    pricingUrl: "https://platform.claude.com/docs/en/about-claude/pricing",
    checked: PRICES_CHECKED,
    currency: "USD",
    source: "counted",
    liveKey: { name: "ANTHROPIC_ADMIN_KEY", where: "console.anthropic.com → Settings → Admin keys (an Admin API key, sk-ant-admin…)" },
  },
  claudePlan: {
    pricingUrl: "https://claude.com/pricing",
    checked: PRICES_CHECKED,
    currency: "USD",
    source: "entered",
    liveKey: null,
  },
  googleMaps: {
    pricingUrl: "https://developers.google.com/maps/billing-and-pricing/pricing",
    checked: PRICES_CHECKED,
    currency: "CAD",
    source: "known",
    liveKey: GOOGLE_BILLING_KEY,
  },
  streetView: {
    pricingUrl: "https://developers.google.com/maps/billing-and-pricing/pricing",
    checked: GOOGLE_EXTRAS_CHECKED,
    currency: "CAD",
    source: "estimated",
    liveKey: GOOGLE_BILLING_KEY,
  },
  addressLookups: {
    pricingUrl: "https://developers.google.com/maps/billing-and-pricing/pricing",
    checked: GOOGLE_EXTRAS_CHECKED,
    currency: "CAD",
    source: "estimated",
    liveKey: GOOGLE_BILLING_KEY,
  },
  supabase: {
    pricingUrl: "https://supabase.com/pricing",
    checked: PRICES_CHECKED,
    currency: "USD",
    source: "entered",
    liveKey: { name: "SUPABASE_ACCESS_TOKEN", where: "supabase.com/dashboard → Account → Access Tokens" },
  },
  vercel: {
    pricingUrl: "https://vercel.com/pricing",
    checked: PRICES_CHECKED,
    currency: "USD",
    source: "entered",
    liveKey: { name: "VERCEL_TOKEN", where: "vercel.com → Account Settings → Tokens" },
  },
  resend: {
    pricingUrl: "https://resend.com/pricing",
    checked: PRICES_CHECKED,
    currency: "USD",
    source: "entered",
    liveKey: null,
  },
  github: {
    pricingUrl: "https://docs.github.com/en/billing/concepts/product-billing/github-actions",
    checked: PRICES_CHECKED,
    currency: "USD",
    source: "entered",
    liveKey: { name: "GITHUB_BILLING_TOKEN", where: "github.com → Settings → Developer settings → Fine-grained tokens, with „Plan: read“" },
  },
  domain: {
    pricingUrl: "https://www.rotld.ro/prices/",
    checked: PRICES_CHECKED,
    currency: "EUR",
    source: "entered",
    liveKey: null,
  },
  testing: {
    pricingUrl: "https://developers.google.com/maps/billing-and-pricing/pricing",
    checked: PRICES_CHECKED,
    currency: "USD",
    source: "counted",
    liveKey: null,
  },
};

// ---- the AI reads' estimate ------------------------------------------------------------

/**
 * ⚠️ **AN UPPER BOUND, AS ADRIAN ASKED — NOT A MEASUREMENT.** The application
 * records each paid read (`ai_paid_read`) but not its tokens, so a read is
 * priced as a large one at the highest price of the models it uses: Sonnet 4.6
 * (`src/lib/ai/models.ts`), US$3 in and US$15 out per million tokens
 * (Anthropic's pricing page, checked 2026-10-12). Haiku's reads cost a third
 * of that and are priced the same, so the estimate only errs upward.
 */
export const AI_READ_UPPER = {
  model: "claude-sonnet-4-6",
  inputTokens: 30_000,
  outputTokens: 4_000,
  usdPerMillionIn: 3,
  usdPerMillionOut: 15,
} as const;

/** US$ for one read at the upper bound: 30,000 × $3/M + 4,000 × $15/M = $0.15. */
export function aiReadUsd(r: typeof AI_READ_UPPER = AI_READ_UPPER): number {
  return (r.inputTokens * r.usdPerMillionIn + r.outputTokens * r.usdPerMillionOut) / 1_000_000;
}

// ---- Google Maps ---------------------------------------------------------------------

/**
 * The days Google Cloud's report showed for project GeoAppNT-01, „Dynamic Maps"
 * (Costs.Oct12.jpg, read in Slice #39.16), in CA$, on Google's own days (US
 * Pacific). Later days are entered on the tile.
 */
export const GOOGLE_MAPS_KNOWN_BILL: readonly { day: string; cad: number }[] = [
  { day: "2026-10-08", cad: 15.19 },
  { day: "2026-10-09", cad: 14.97 },
  { day: "2026-10-10", cad: 21.97 },
  { day: "2026-10-11", cad: 10.17 },
];

/**
 * What a day of people using the maps is expected to cost once the month's
 * free 10,000 are spent: about 50 maps at roughly 1 cent (Slice #39.16's
 * document, Section 5). While the month is still inside the free allowance the
 * expectation is nothing.
 */
export const GOOGLE_MAPS_PEOPLE_DAILY_CAD = 0.5;

/**
 * ⚠️ **ESTIMATES, NOT COUNTS** (Slice #39.19) — nothing in the browser counts people's Street View panoramas or
 * address look-ups yet (FU-327). How the application uses each is what they rest on:
 *   - Street View: the property's „Street View" tile is OFF until someone ticks it, and only then is a panorama built
 *     — about 10 a day is generous for one person looking at a few properties.
 *   - Address look-ups: one per click on „Preia din Street View" when filling a property's address — about 5 a day.
 * Change a number here and nowhere else; the tile says it is an estimate.
 */
export const GOOGLE_STREET_VIEW_PEOPLE_PER_DAY = 10;
export const GOOGLE_ADDRESS_LOOKUPS_PEOPLE_PER_DAY = 5;

/**
 * Google's two other charges (pricing page read 2026-10-13): each with its own free monthly allowance, apart from
 * the maps' 10,000, and its price past it. `testsCeiling` repeats the test runner's own ceilings
 * (`scripts/test-runner/protocol.ts` → STREET_VIEW_MONTHLY_CEILING, ADDRESS_LOOKUPS_MONTHLY_CEILING; Slice #39.18) —
 * the screen cannot import the runner, so `settings-costs.test.ts` holds the two equal.
 */
export const GOOGLE_EXTRAS = {
  streetView: { sku: "Dynamic Street View", freePerMonth: 5_000, usdPer1000: 14, testsCeiling: 1_500, peoplePerDay: GOOGLE_STREET_VIEW_PEOPLE_PER_DAY },
  addressLookups: { sku: "Geocoding", freePerMonth: 10_000, usdPer1000: 5, testsCeiling: 3_000, peoplePerDay: GOOGLE_ADDRESS_LOOKUPS_PEOPLE_PER_DAY },
} as const;
export type GoogleExtra = keyof typeof GOOGLE_EXTRAS;

/** The tests' monthly ceiling on real maps (`MAPS_MONTHLY_CEILING`, Slice #39.16), for the „Testare" tile. */
export const TESTS_MAPS_CEILING = 3_000;

// ---- the CA$ rates used for figures the application works out itself ----------------

/**
 * Approximate, entered 2026-10-12. An entered amount carries the rate typed
 * with it (`cost_record.cad_rate`); these are only for the counted figures.
 */
export const CAD_PER: Readonly<Record<"CAD" | "USD" | "EUR", number>> = { CAD: 1, USD: 1.38, EUR: 1.6 };
export const RATES_ENTERED = "2026-10-12";

/** GitHub Actions: CI and the DB rebuild together, about 186 s per push (CI #426, Oct 12). */
export const CI_MINUTES_PER_PUSH = 4;
