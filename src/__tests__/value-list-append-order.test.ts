/**
 * @jest-environment node
 *
 * FU-056 — a value added in Date de referință sorts after the seeded ones.
 *                                                              (Slice #37.07)
 *
 * The create schemas defaulted `sortOrder` to 0 and no admin form sets it, so
 * every added row went to the TOP of each list ordered by the column, above
 * the seeded ones. Absent now means „after": createValue gives the new row the
 * list's largest sort_order plus 10. A stated number is kept.
 */
const captured: Record<string, unknown>[] = [];
let mockMax: number | string | null = 30;

jest.mock("@/db", () => ({
  db: {
    select: () => ({ from: async () => [{ max: mockMax }] }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        captured.push(v);
        return { returning: async () => [{ id: "new", ...v }] };
      },
    }),
  },
}));

import { createValue, nextSortOrder } from "@/lib/admin/value-lists/queries";
import { LIST_SCHEMAS } from "@/lib/admin/value-lists/validation";

beforeEach(() => {
  captured.length = 0;
  mockMax = 30;
});

describe("FU-056: a new reference value goes after the others", () => {
  it("parses a create with no position as no position, not as 0", () => {
    expect(LIST_SCHEMAS["property-types"].parse({ name: "Teren nou" })).not.toHaveProperty("sortOrder");
  });

  it("writes the list's largest sort_order plus 10", async () => {
    await createValue("property-types", LIST_SCHEMAS["property-types"].parse({ name: "Teren nou" }));
    expect(captured[0]).toMatchObject({ name: "Teren nou", sortOrder: 40 });
  });

  it("starts an empty list at 10, and reads a numeric answer given as a string", async () => {
    mockMax = null;
    expect(await nextSortOrder("property-types")).toBe(10);
    mockMax = "15";
    expect(await nextSortOrder("property-types")).toBe(25);
  });

  it("keeps a position the caller stated", async () => {
    await createValue("property-types", LIST_SCHEMAS["property-types"].parse({ name: "Teren nou", sortOrder: 5 }));
    expect(captured[0]).toMatchObject({ sortOrder: 5 });
  });

  it("gives no position on a list that has none", async () => {
    expect(await nextSortOrder("person-roles")).toBeNull();
  });
});
