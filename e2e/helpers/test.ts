/**
 * e2e/helpers/test.ts                                          (Slice #39.14)
 *
 * The `test` every spec imports — Playwright's own, plus one automatic fixture:
 *
 * ⚠️ **GOOGLE MAPS IS BLOCKED IN E2E BY DEFAULT.** Every request the Maps
 * JavaScript API would make (`./google-maps.ts` → `isGoogleMapsUrl`) is aborted,
 * so no `google.maps.Map` is ever constructed and Google bills nothing. A page
 * whose map cannot load still renders; its spec still passes.
 *
 * A spec whose SUBJECT is the map opts back in, in one line, at its top:
 *
 *     test.use({ realMaps: true }); // why: what this spec reads inside the map
 *
 * Every real map is then counted — the page-side counter sees each
 * `new google.maps.Map(...)` — and, when the test runner set `E2E_MAPS_LOG`,
 * written as one line per test, which the runner adds up into a note on its
 * e2e step: „Google maps loaded: N". `src/__tests__/e2e-google-maps.test.ts`
 * fails when a spec imports `test` from `@playwright/test` instead of here, which
 * would quietly load maps again.
 *
 * ⚠️ **AND THE MONTH HAS A CEILING.** (Slice #39.16.) When the test runner has
 * counted `MAPS_MONTHLY_CEILING` real maps this month, it sets `E2E_MAPS_CEILING`
 * for its e2e run. Then nothing gets real maps — and a spec that opted in is
 * SKIPPED with the ceiling named, not failed: its subject is the map, and a run
 * with no map would only fail it for a reason that is not a defect.
 *
 * ⚠️ **STREET VIEW AND ADDRESS LOOK-UPS ARE BLOCKED TOO, EVEN WITH realMaps.**
 * (Slice #39.18.) Google bills each Street View panorama and each address
 * look-up under its own line, apart from the maps. A spec that opted in for the
 * map gets the map and nothing else; one whose subject is Street View, or the
 * „Preia din Street View" button, opts in for that kind as well, each on its own
 * line with its reason:
 *
 *     test.use({ realStreetView: true }); // why: what this spec reads in the panorama
 *     test.use({ realAddressLookups: true }); // why: what this spec reads from the look-up
 *
 * Both come through the Maps JavaScript API, so each needs `realMaps` beside it.
 * Each is counted (`./google-maps.ts` → `googleCounterScript`), and each has a
 * monthly ceiling of its own (`STREET_VIEW_MONTHLY_CEILING`,
 * `ADDRESS_LOOKUPS_MONTHLY_CEILING`): past it the runner sets
 * `E2E_STREET_VIEW_CEILING` / `E2E_ADDRESS_LOOKUPS_CEILING`, the kind is blocked
 * for every test, and a spec that opted in for it is skipped, never failed.
 */

import fs from "node:fs";
import path from "node:path";
import { test as base } from "@playwright/test";
import {
  ADDRESS_LOOKUPS_CEILING_ENV,
  MAPS_CEILING_ENV,
  MAPS_LOG_ENV,
  STREET_VIEW_CEILING_ENV,
  type MapsLogLine,
} from "../../scripts/test-runner/protocol";
import {
  MAP_COUNTER_BINDING,
  googleCounterScript,
  isAddressLookupUrl,
  isGoogleMapsUrl,
  isMapsLoaderUrl,
  isStreetViewUrl,
  type GoogleCount,
} from "./google-maps";

export * from "@playwright/test";

/** Off only to measure: with it false nothing is blocked and every map, panorama and look-up is counted. */
const BLOCK_BY_DEFAULT = true;

type MapsOptions = {
  /** This spec's subject is the map: let Google Maps load, and count what it makes. */
  realMaps: boolean;
  /** This spec's subject is Street View: let panoramas be built, and count them. Needs `realMaps` too.   (#39.18) */
  realStreetView: boolean;
  /** This spec's subject is an address look-up („Preia din Street View"): let it reach Google, and count it. Needs `realMaps` too. */
  realAddressLookups: boolean;
};

export const test = base.extend<MapsOptions & { googleMaps: void }>({
  realMaps: [false, { option: true }],
  realStreetView: [false, { option: true }],
  realAddressLookups: [false, { option: true }],
  googleMaps: [
    async ({ context, realMaps, realStreetView, realAddressLookups }, use, testInfo) => {
      if ((realStreetView || realAddressLookups) && !realMaps) {
        throw new Error(
          "realStreetView and realAddressLookups come through the Maps JavaScript API: opt in with test.use({ realMaps: true }) as well (e2e/helpers/test.ts, Slice #39.18)",
        );
      }
      const ceilingReached = process.env[MAPS_CEILING_ENV];
      const streetViewCeiling = process.env[STREET_VIEW_CEILING_ENV];
      const lookupsCeiling = process.env[ADDRESS_LOOKUPS_CEILING_ENV];
      const letThrough = (realMaps || !BLOCK_BY_DEFAULT) && !ceilingReached;
      // Slice #39.18: a map spec gets the map only — Street View and look-ups each need their own opt-in.
      const letStreetView = letThrough && (realStreetView || !BLOCK_BY_DEFAULT) && !streetViewCeiling;
      const letLookups = letThrough && (realAddressLookups || !BLOCK_BY_DEFAULT) && !lookupsCeiling;
      const tally = { maps: 0, loaders: 0, blocked: 0, streetView: 0, streetViewRequests: 0, streetViewBlocked: 0, addressLookups: 0, addressLookupsBlocked: 0 };
      const file = process.env[MAPS_LOG_ENV];
      const writeLine = (): void => {
        if (!file) return;
        const line: MapsLogLine = {
          spec: path.relative(path.join(__dirname, ".."), testInfo.file).replace(/\\/g, "/"),
          title: testInfo.titlePath.slice(1).join(" › "),
          realMaps: letThrough,
          realStreetView: letStreetView,
          realAddressLookups: letLookups,
          ...tally,
        };
        fs.appendFileSync(file, JSON.stringify(line) + "\n");
      };
      // Slice #39.16 / #39.18: a kind's month is used up — a spec whose subject is that kind is skipped, never failed.
      const skipFor = (realMaps && ceilingReached) || (realStreetView && streetViewCeiling) || (realAddressLookups && lookupsCeiling);
      if (skipFor) {
        writeLine();
        testInfo.skip(true, skipFor);
        return;
      }
      if (letThrough) {
        // Slice #39.18: the same counter also sees each Street View panorama built and each address look-up made.
        await context.exposeBinding(MAP_COUNTER_BINDING, (_source, kind?: GoogleCount) => {
          if (kind === "streetView") tally.streetView++;
          else if (kind === "addressLookup") tally.addressLookups++;
          else if (kind === "streetViewBlocked") tally.streetViewBlocked++;
          else if (kind === "addressLookupBlocked") tally.addressLookupsBlocked++;
          else tally.maps++;
        });
        await context.addInitScript({ content: googleCounterScript({ streetView: letStreetView, addressLookups: letLookups }) });
        context.on("request", (r) => {
          if (isMapsLoaderUrl(r.url())) tally.loaders++;
          if (letStreetView && isStreetViewUrl(r.url())) tally.streetViewRequests++;
        });
        // The page-side stubs stop the app's own calls; this stops what bypasses the app — Google's Street View
        // figure dragged onto a map — and anything the stubs did not see.
        if (!letStreetView || !letLookups) {
          await context.route(
            (u) => (!letStreetView && isStreetViewUrl(u)) || (!letLookups && isAddressLookupUrl(u)),
            (route) => {
              if (isStreetViewUrl(route.request().url())) tally.streetViewBlocked++;
              else tally.addressLookupsBlocked++;
              return route.abort("blockedbyclient");
            },
          );
        }
      } else {
        await context.route(isGoogleMapsUrl, (route) => {
          tally.blocked++;
          // The loader is answered with an empty script rather than aborted: an abort makes the app's map provider
          // log „The Google Maps JavaScript API failed to load." with console.error, which next dev shows as an
          // „Issue" badge in every picture of a page with a map. An empty script never calls back, so the API never
          // loads, no map is made, and nothing is logged.
          if (isMapsLoaderUrl(route.request().url())) {
            return route.fulfill({ status: 200, contentType: "text/javascript", body: "/* e2e: Google Maps blocked (Slice #39.14) */" });
          }
          return route.abort("blockedbyclient");
        });
      }
      await use();
      writeLine();
    },
    { auto: true },
  ],
});
