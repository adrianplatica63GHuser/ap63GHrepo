/**
 * Unit tests for streetLineFromGeocodeResult (Slice #18.12).
 *
 * Pure extraction of a single street line from a reverse-geocode result — no
 * Maps API needed; results are plain objects shaped like GeocoderResult.
 */

import { streetLineFromGeocodeResult } from "@/lib/geo/reverse-geocode";

const comp = (long_name: string, types: string[]) => ({
  long_name,
  short_name: long_name,
  types,
});

describe("streetLineFromGeocodeResult", () => {
  it("combines route + street number as '<route> nr. <number>'", () => {
    expect(
      streetLineFromGeocodeResult({
        address_components: [
          comp("12", ["street_number"]),
          comp("Strada Florilor", ["route"]),
          comp("Bragadiru", ["locality"]),
        ],
        formatted_address: "Strada Florilor 12, Bragadiru, Romania",
      }),
    ).toBe("Strada Florilor nr. 12");
  });

  it("returns just the route when there is no street number", () => {
    expect(
      streetLineFromGeocodeResult({
        address_components: [comp("Strada Florilor", ["route"])],
        formatted_address: "Strada Florilor, Bragadiru, Romania",
      }),
    ).toBe("Strada Florilor");
  });

  it("falls back to the first formatted-address segment when no route", () => {
    expect(
      streetLineFromGeocodeResult({
        address_components: [comp("Bragadiru", ["locality"])],
        formatted_address: "Strada Necunoscută 5, Bragadiru, Romania",
      }),
    ).toBe("Strada Necunoscută 5");
  });

  it("returns null when there is nothing usable", () => {
    expect(streetLineFromGeocodeResult({})).toBeNull();
    expect(streetLineFromGeocodeResult(null)).toBeNull();
    expect(streetLineFromGeocodeResult(undefined)).toBeNull();
    expect(
      streetLineFromGeocodeResult({ address_components: [], formatted_address: "" }),
    ).toBeNull();
  });

  it("ignores blank component names", () => {
    expect(
      streetLineFromGeocodeResult({
        address_components: [
          comp("  ", ["route"]),
          comp("9", ["street_number"]),
        ],
        formatted_address: "Bragadiru, Romania",
      }),
    ).toBe("Bragadiru");
  });
});
