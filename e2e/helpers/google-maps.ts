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
 *
 * Slice #39.18 adds Google's two other charges, which come through the same
 * API: a Street View panorama („Dynamic Street View", US$14 per 1,000 past
 * 5,000 a month) and an address look-up („Geocoding", US$5 per 1,000 past
 * 10,000 a month) — Google's pricing page, read 2026-10-13. Each is counted in
 * the page, and each is stopped unless the spec opted in for that kind as well.
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
 * Street View's own requests: the imagery, its metadata and the coverage look-up behind it. The app's panel never
 * gets this far when Street View is blocked (the page-side stub answers first); this catches what bypasses the app —
 * Google's Street View figure dragged onto a map. Counted when let through, as a cross-check on the panoramas.
 */
export function isStreetViewUrl(url: string | URL): boolean {
  const u = parse(url);
  if (!u || (u.protocol !== "https:" && u.protocol !== "http:")) return false;
  if (u.hostname === "streetviewpixels-pa.googleapis.com" || /^cbk\d*\.googleapis\.com$/.test(u.hostname)) return true;
  if (u.hostname === "maps.googleapis.com" && u.pathname.startsWith("/maps/api/js/GeoPhotoService.")) return true;
  return u.hostname === "maps.google.com" && u.pathname.startsWith("/maps/photometa/");
}

/** An address look-up: the Geocoder's request inside the Maps JavaScript API, or the Geocoding web service. */
export function isAddressLookupUrl(url: string | URL): boolean {
  const u = parse(url);
  if (!u || u.hostname !== "maps.googleapis.com") return false;
  return u.pathname.startsWith("/maps/api/js/GeocodeService.") || u.pathname.startsWith("/maps/api/geocode/");
}

/** What the page-side counter reports, one call per event. A call with no kind is a map (the 39.14 counter's shape). */
export type GoogleCount = "map" | "streetView" | "addressLookup" | "streetViewBlocked" | "addressLookupBlocked";
export const GOOGLE_COUNTS: readonly GoogleCount[] = ["map", "streetView", "addressLookup", "streetViewBlocked", "addressLookupBlocked"];

/** Which of the two extra kinds the page may let reach Google. */
export type GoogleAllow = { streetView: boolean; addressLookups: boolean };

/**
 * The page-side counter, as an init script. It calls the binding `__ga40MapCreated(kind)`:
 *
 * - `"map"` for every `new google.maps.Map(...)` — `google.maps.Map` wrapped in a Proxy whose only trap is
 *   `construct`, installed through accessors on `window.google` and `google.maps`, because the API assigns both long
 *   after the page starts. (Slice #39.14, unchanged.)
 * - `"streetView"` for every `StreetViewPanorama` built — what Google bills as „Dynamic Street View". The app takes
 *   the class from `importLibrary("streetView")`, not from `google.maps`, so `importLibrary` is wrapped too and the
 *   library it resolves to has its `StreetViewPanorama` swapped for the counting Proxy.
 * - `"addressLookup"` for every `Geocoder.prototype.geocode` call — what Google bills as „Geocoding". Patched on the
 *   prototype, so every Geocoder counts whichever way the app reached the class.
 * - `"streetViewBlocked"` / `"addressLookupBlocked"` when `allow` says no (Slice #39.18): `getPanorama` answers
 *   `UNKNOWN_ERROR` — the coverage check is free, but without it the app never builds the panorama — and `geocode`
 *   rejects. Both are what Google's own failure looks like to the app, so the page shows its ordinary error and
 *   nothing reaches Google.
 *
 * Anything made another way is missed — which is why the fixture also counts the requests that get through, and the
 * note reports the two side by side. `src/__tests__/e2e-google-maps.test.ts` runs this script against a stand-in
 * `google.maps` and pins every path above.
 */
export const MAP_COUNTER_BINDING = "__ga40MapCreated";
export function googleCounterScript(allow: GoogleAllow): string {
  return `(() => {
  const ALLOW = { streetView: ${allow.streetView ? "true" : "false"}, addressLookups: ${allow.addressLookups ? "true" : "false"} };
  const report = (kind) => { try { window.${MAP_COUNTER_BINDING}(kind); } catch (e) { /* binding gone with the page */ } };
  const proxies = new WeakMap();
  const isProxy = new WeakSet();
  const counted = (M, kind) => {
    if (typeof M !== "function" || isProxy.has(M)) return M;
    let P = proxies.get(M);
    if (!P) {
      P = new Proxy(M, { construct(t, args, nt) { report(kind); return Reflect.construct(t, args, nt === P ? t : nt); } });
      proxies.set(M, P);
      isProxy.add(P);
    }
    return P;
  };
  const refused = (callback, status, message) => {
    if (typeof callback === "function") setTimeout(() => { try { callback(null, status); } catch (e) { /* the page's own */ } }, 0);
    const r = Promise.reject(new Error(message));
    r.catch(() => {});
    return r;
  };
  const patched = new WeakSet();
  const patchGeocoder = (G) => {
    const p = G && G.prototype;
    if (!p || patched.has(p) || typeof p.geocode !== "function") return;
    patched.add(p);
    const real = p.geocode;
    try {
      p.geocode = function (request, callback) {
        if (!ALLOW.addressLookups) {
          report("addressLookupBlocked");
          return refused(callback, "REQUEST_DENIED", "e2e: address look-ups are blocked (Slice #39.18)");
        }
        report("addressLookup");
        return real.apply(this, arguments);
      };
    } catch (e) { /* not ours to patch */ }
  };
  const patchService = (S) => {
    const p = S && S.prototype;
    if (!p || patched.has(p) || typeof p.getPanorama !== "function") return;
    patched.add(p);
    const real = p.getPanorama;
    try {
      p.getPanorama = function (request, callback) {
        if (!ALLOW.streetView) {
          report("streetViewBlocked");
          return refused(callback, "UNKNOWN_ERROR", "e2e: Street View is blocked (Slice #39.18)");
        }
        return real.apply(this, arguments);
      };
    } catch (e) { /* not ours to patch */ }
  };
  const patchLibrary = (lib) => {
    if (!lib || typeof lib !== "object") return lib;
    try { patchGeocoder(lib.Geocoder); } catch (e) { /* no geocoder here */ }
    try { patchService(lib.StreetViewService); } catch (e) { /* no service here */ }
    try {
      const SV = lib.StreetViewPanorama;
      if (typeof SV === "function" && !isProxy.has(SV)) {
        Object.defineProperty(lib, "StreetViewPanorama", { value: counted(SV, "streetView"), configurable: true, enumerable: true, writable: true });
      }
    } catch (e) { /* a frozen library: the request count still sees its panoramas */ }
    return lib;
  };
  const wrappedImports = new WeakSet();
  const wrapImport = (f) => {
    if (typeof f !== "function" || wrappedImports.has(f)) return f;
    const w = function () { return Promise.resolve(f.apply(this, arguments)).then(patchLibrary); };
    wrappedImports.add(w);
    return w;
  };
  const ON_SET = {
    Map: (n) => counted(n, "map"),
    StreetViewPanorama: (n) => counted(n, "streetView"),
    Geocoder: (n) => { patchGeocoder(n); return n; },
    StreetViewService: (n) => { patchService(n); return n; },
    importLibrary: (n) => wrapImport(n),
  };
  const hook = (obj, key, transform, onSet) => {
    let v = transform ? transform(obj[key]) : obj[key];
    if (onSet) onSet(v);
    try {
      Object.defineProperty(obj, key, {
        configurable: true, enumerable: true,
        get: () => v,
        set: (n) => { v = transform ? transform(n) : n; if (onSet) onSet(n); },
      });
    } catch (e) { /* not ours to hook */ }
  };
  const seen = new WeakSet();
  const hookMaps = (maps) => {
    if (!maps || typeof maps !== "object" || seen.has(maps)) return;
    seen.add(maps);
    for (const key of Object.keys(ON_SET)) hook(maps, key, ON_SET[key]);
  };
  const hookGoogle = (g) => { if (g && typeof g === "object" && !seen.has(g)) { seen.add(g); hook(g, "maps", null, hookMaps); } };
  hook(window, "google", null, hookGoogle);
})();`;
}
