/**
 * Reverse-geocoding helpers (Slice #18.12).
 *
 * The Property form lets the user pull a "Street View address" for a parcel by
 * reverse-geocoding the centroid of its corners. The Google Geocoder call lives
 * in the form (it needs the live `google.maps.Geocoder`); this module holds the
 * PURE extraction step — turning a geocoder result into a single street line —
 * so it can be unit-tested without the Maps API.
 *
 * For a Romanian address the postal code / locality / county / country match the
 * property's existing address, so we deliberately keep only the street portion:
 * route (street name) + street number, e.g. "Strada Florilor nr. 12". When the
 * components are missing we fall back to the first comma-separated segment of
 * the formatted address (which is usually the same street + number).
 */

/** The subset of a `google.maps.GeocoderResult` we read. Declared structurally
 *  so callers can pass the real result and tests can pass plain objects. */
export type GeocodeAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type GeocodeLike = {
  address_components?: GeocodeAddressComponent[];
  formatted_address?: string;
};

function componentLongName(
  components: GeocodeAddressComponent[],
  type: string,
): string | null {
  const hit = components.find((c) => Array.isArray(c.types) && c.types.includes(type));
  const name = hit?.long_name?.trim();
  return name && name.length > 0 ? name : null;
}

/**
 * Build a single street line from a reverse-geocode result, or null if nothing
 * usable was found.
 *
 *  - route + street_number  → "<route> nr. <number>"  (e.g. "Strada Florilor nr. 12")
 *  - route only             → "<route>"
 *  - neither                → first segment of formatted_address, else null
 */
export function streetLineFromGeocodeResult(result: GeocodeLike | null | undefined): string | null {
  if (!result) return null;

  const components = result.address_components ?? [];
  const route = componentLongName(components, "route");
  const number = componentLongName(components, "street_number");

  if (route && number) return `${route} nr. ${number}`;
  if (route) return route;

  const formatted = result.formatted_address?.trim();
  if (formatted) {
    const first = formatted.split(",")[0]?.trim();
    if (first && first.length > 0) return first;
  }
  return null;
}
