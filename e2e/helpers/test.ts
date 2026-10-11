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
 */

import fs from "node:fs";
import path from "node:path";
import { test as base } from "@playwright/test";
import { MAPS_LOG_ENV, type MapsLogLine } from "../../scripts/test-runner/protocol";
import { MAP_COUNTER_BINDING, MAP_COUNTER_SCRIPT, isGoogleMapsUrl, isMapsLoaderUrl } from "./google-maps";

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
      const letThrough = realMaps || !BLOCK_BY_DEFAULT;
      const tally = { maps: 0, loaders: 0, blocked: 0 };
      if (letThrough) {
        await context.exposeBinding(MAP_COUNTER_BINDING, () => {
          tally.maps++;
        });
        await context.addInitScript({ content: MAP_COUNTER_SCRIPT });
        context.on("request", (r) => {
          if (isMapsLoaderUrl(r.url())) tally.loaders++;
        });
      } else {
        await context.route(isGoogleMapsUrl, (route) => {
          tally.blocked++;
          return route.abort("blockedbyclient");
        });
      }
      await use();
      const file = process.env[MAPS_LOG_ENV];
      if (file) {
        const line: MapsLogLine = {
          spec: path.relative(path.join(__dirname, ".."), testInfo.file).replace(/\\/g, "/"),
          title: testInfo.titlePath.slice(1).join(" › "),
          realMaps: letThrough,
          ...tally,
        };
        fs.appendFileSync(file, JSON.stringify(line) + "\n");
      }
    },
    { auto: true },
  ],
});
