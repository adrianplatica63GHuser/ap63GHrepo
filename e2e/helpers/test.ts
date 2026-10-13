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
 */

import fs from "node:fs";
import path from "node:path";
import { test as base } from "@playwright/test";
import { MAPS_CEILING_ENV, MAPS_LOG_ENV, type MapsLogLine } from "../../scripts/test-runner/protocol";
import { MAP_COUNTER_BINDING, googleCounterScript, isGoogleMapsUrl, isMapsLoaderUrl, isStreetViewUrl, type GoogleCount } from "./google-maps";

export * from "@playwright/test";

/** Off only to measure: with it false nothing is blocked and every map is counted. */
const BLOCK_BY_DEFAULT = true;

type MapsOptions = {
  /** This spec's subject is the map: let Google Maps load, and count what it makes. */
  realMaps: boolean;
};

export const test = base.extend<MapsOptions & { googleMaps: void }>({
  realMaps: [false, { option: true }],
  googleMaps: [
    async ({ context, realMaps }, use, testInfo) => {
      const ceilingReached = process.env[MAPS_CEILING_ENV];
      const letThrough = (realMaps || !BLOCK_BY_DEFAULT) && !ceilingReached;
      const tally = { maps: 0, loaders: 0, blocked: 0, streetView: 0, streetViewRequests: 0, streetViewBlocked: 0, addressLookups: 0, addressLookupsBlocked: 0 };
      const file = process.env[MAPS_LOG_ENV];
      const writeLine = (): void => {
        if (!file) return;
        const line: MapsLogLine = {
          spec: path.relative(path.join(__dirname, ".."), testInfo.file).replace(/\\/g, "/"),
          title: testInfo.titlePath.slice(1).join(" › "),
          realMaps: letThrough,
          realStreetView: letThrough,
          realAddressLookups: letThrough,
          ...tally,
        };
        fs.appendFileSync(file, JSON.stringify(line) + "\n");
      };
      if (realMaps && ceilingReached) {
        // Slice #39.16: the month's ceiling is reached — a spec whose subject is the map is skipped, never failed.
        writeLine();
        testInfo.skip(true, ceilingReached);
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
        await context.addInitScript({ content: googleCounterScript({ streetView: true, addressLookups: true }) });
        context.on("request", (r) => {
          if (isMapsLoaderUrl(r.url())) tally.loaders++;
          if (isStreetViewUrl(r.url())) tally.streetViewRequests++;
        });
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
