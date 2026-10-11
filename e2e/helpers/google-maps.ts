/**
 * e2e/helpers/google-maps.ts                                   (Slice #39.14)
 *
 * Which browser requests are Google Maps, for the fixture in `./test.ts` that
 * blocks them by default. Pure — no Playwright import — so jest pins it
 * (`src/__tests__/e2e-google-maps.test.ts`).
 *
 * WHY: Google bills „Dynamic Maps" per map created with the key, US$7 per 1,000
 * past 10,000 a month. The runner's e2e made about 1,500 of them a day and
 * spent October's free 10,000 by the 8th (Slice #39.14's header). Aborting the
 * Maps JavaScript API loader means no `google.maps.Map` is ever constructed, so
 * nothing is billed; the few specs whose subject is the map opt back in.
 */

/** The hosts the Maps JavaScript API loads from: the loader, its modules, tiles, Street View. */
const MAPS_HOSTS = [
  /^maps\.googleapis\.com$/,
  /^maps\.gstatic\.com$/,
  /^maps\.google\.com$/,
  /^khms\d*\.googleapis\.com$/,
  /^streetviewpixels-pa\.googleapis\.com$/,
] as const;

function parse(url: string | URL): URL | null {
  if (url instanceof URL) return url;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** True for every request the Maps JavaScript API (or Street View) would make. Fonts, OAuth and the rest of Google are not maps. */
export function isGoogleMapsUrl(url: string | URL): boolean {
  const u = parse(url);
  if (!u || (u.protocol !== "https:" && u.protocol !== "http:")) return false;
  return MAPS_HOSTS.some((h) => h.test(u.hostname));
}

/** The Maps JavaScript API's own script — fetched once per page that starts a map, carrying the key. */
export function isMapsLoaderUrl(url: string | URL): boolean {
  const u = parse(url);
  return !!u && u.hostname === "maps.googleapis.com" && u.pathname === "/maps/api/js";
}

/**
 * The page-side counter, as an init script: every `new google.maps.Map(...)`
 * calls the binding `__ga40MapCreated`. It wraps `google.maps.Map` in a Proxy
 * whose only trap is `construct`, installed through accessors on `window.google`
 * and `google.maps`, because the API assigns both long after the page starts.
 * A map made any other way would be missed — which is why the fixture also
 * counts the loader fetches, and the two are reported side by side.
 */
export const MAP_COUNTER_BINDING = "__ga40MapCreated";
export const MAP_COUNTER_SCRIPT = `(() => {
  const report = () => { try { window.${MAP_COUNTER_BINDING}(); } catch (e) { /* binding gone with the page */ } };
  const wrapped = new WeakSet();
  const wrap = (M) => {
    if (typeof M !== "function" || wrapped.has(M)) return M;
    const P = new Proxy(M, { construct(t, args, nt) { report(); return Reflect.construct(t, args, nt === P ? t : nt); } });
    wrapped.add(P);
    return P;
  };
  const hook = (obj, key, onSet) => {
    let v = obj[key];
    if (onSet) onSet(v);
    try {
      Object.defineProperty(obj, key, {
        configurable: true, enumerable: true,
        get: () => v,
        set: (n) => { v = key === "Map" ? wrap(n) : n; if (onSet) onSet(n); },
      });
      if (key === "Map") v = wrap(v);
    } catch (e) { /* not ours to hook */ }
  };
  const seen = new WeakSet();
  const hookMaps = (maps) => { if (maps && typeof maps === "object" && !seen.has(maps)) { seen.add(maps); hook(maps, "Map"); } };
  const hookGoogle = (g) => { if (g && typeof g === "object" && !seen.has(g)) { seen.add(g); hook(g, "maps", hookMaps); } };
  hook(window, "google", hookGoogle);
})();`;
