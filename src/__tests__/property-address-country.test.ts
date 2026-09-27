/**
 * A property's address is never dropped because „Țară" is blank.
 *                                                    (Slice #37.04, FU-013)
 *
 * THE DEFECT
 * ──────────
 * `toApiPayload` sent `address: null` whenever „Țară" was blank, because
 * `property_address.country` is NOT NULL — so a street, a locality, and the
 * Street View line typed by hand were discarded on „Salvează" with nothing on
 * screen saying so. Now a blank „Țară" beside any other address field becomes
 * „România" — the form says so under the field — and an address with nothing
 * in it at all is still no address.
 *
 * RED ON THE CODE BEFORE THIS SLICE: committed on its own, ahead of the fix.
 */

import { emptyFormValues, toApiPayload, type FormValues } from "@/app/properties/_components/form-schema";

function withAddress(address: Partial<FormValues["address"]>): FormValues {
  return { ...emptyFormValues, address: { ...emptyFormValues.address, ...address } };
}

describe("toApiPayload — the address and a blank „Țară” (FU-013)", () => {
  it("keeps a street and a locality, and fills „Țară” with „România”", () => {
    const payload = toApiPayload(withAddress({ streetLine: "Str. Morii 7", locality: "Clinceni" }), []);
    expect(payload.address).not.toBeNull();
    expect(payload.address?.streetLine).toBe("Str. Morii 7");
    expect(payload.address?.locality).toBe("Clinceni");
    expect(payload.address?.country).toBe("România");
  });

  it("keeps the Street View line on its own", () => {
    const payload = toApiPayload(withAddress({ streetViewStreetLine: "Strada Morii 7, Clinceni" }), []);
    expect(payload.address?.streetViewStreetLine).toBe("Strada Morii 7, Clinceni");
    expect(payload.address?.country).toBe("România");
  });

  it("keeps a country someone typed", () => {
    const payload = toApiPayload(withAddress({ locality: "Chișinău", country: "Moldova" }), []);
    expect(payload.address?.country).toBe("Moldova");
  });

  it("an address with nothing in it is still no address", () => {
    expect(toApiPayload(withAddress({}), []).address).toBeNull();
    expect(toApiPayload(withAddress({ streetLine: "   " }), []).address).toBeNull();
  });
});
