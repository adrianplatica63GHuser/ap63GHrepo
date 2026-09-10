/**
 * Zod schema for the Property form values.
 *
 * All fields are plain strings (React Hook Form convention).
 * `corners` are managed separately as React state — not registered with RHF.
 * `toApiPayload` converts form values + corners into the shape the API expects.
 */

import { z } from "zod/v4";
import {
  resolveSnapshotLookup,
  snapshotRecordedText,
  type SnapshotLookupOption,
  type SnapshotLookupState,
} from "@/lib/versioning/snapshot-lookup";
import {
  PROPERTY_SNAPSHOT_ADDRESS_KEYS,
  PROPERTY_SNAPSHOT_PROPERTY_KEYS,
} from "@/lib/versioning/snapshot-registry";
import type {
  PropertyCreate,
  PropertySnapshot,
  PropertySnapshotAddress,
  PropertySnapshotProperty,
  PropertyUpdate,
} from "@/lib/properties/validation";

// ---------------------------------------------------------------------------
// Corner (client-side, WGS84 decimal degrees)
// ---------------------------------------------------------------------------

export type Corner = { lat: number; lon: number; originalIndex?: number | null };

// ---------------------------------------------------------------------------
// Centroid of a corner set (Slice #18.03b)
// ---------------------------------------------------------------------------
//
// Plain arithmetic mean of the corners' lat/lon — used to position the Street
// View panel. Street View snaps to the nearest captured road imagery anyway,
// so a true polygon centroid is unnecessary; the average point is close enough
// to find the relevant panorama. Returns null when there are no corners (the
// panel then shows its "add a corner first" empty state).

export function cornersCentroid(
  corners: Corner[],
): { lat: number; lon: number } | null {
  if (corners.length === 0) return null;
  let lat = 0;
  let lon = 0;
  for (const c of corners) {
    lat += c.lat;
    lon += c.lon;
  }
  return { lat: lat / corners.length, lon: lon / corners.length };
}

// ---------------------------------------------------------------------------
// Form schema — all strings; validated on the client before submission
// ---------------------------------------------------------------------------

const addressBlockSchema = z.object({
  streetLine: z.string(),
  postalCode: z.string(),
  locality:   z.string(),
  county:     z.string(),
  country:    z.string(),
  notes:      z.string(),
  // Slice #18.12: Street View-derived street line; shares the fields above.
  streetViewStreetLine: z.string(),
});

export type AddressBlock = z.infer<typeof addressBlockSchema>;

export const formSchema = z.object({
  // Slice #15.16: FK ids to admin-managed lookup tables. "" = unset.
  propertyTypeId:  z.string(),
  nickname:        z.string(),
  // Slice #34.03: "" | <lookup_tarla.id uuid>. Was the CODE as free text; the
  // field is now the same shape as the two lookup ids around it.
  tarlaId:         z.string(),
  parcela:         z.string(),
  cadastralNumber: z.string(),
  carteFunciara:   z.string(),
  useCategoryId:   z.string(), // "" | <lookup_use_category.id uuid>
  surfaceAreaMp:   z
    .string()
    .refine(
      (v) => v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) > 0),
      { message: "Surface area must be a positive number" },
    ),
  notes:   z.string().max(300, "Notes limited to 300 characters"),
  address: addressBlockSchema,
});

export type FormValues = z.infer<typeof formSchema>;

// ---------------------------------------------------------------------------
// Empty defaults
// ---------------------------------------------------------------------------

const emptyAddress: AddressBlock = {
  streetLine: "", postalCode: "", locality: "",
  county: "",    country: "",    notes: "",
  streetViewStreetLine: "",
};

export const emptyFormValues: FormValues = {
  propertyTypeId: "",
  nickname: "", tarlaId: "", parcela: "",
  cadastralNumber: "", carteFunciara: "",
  useCategoryId: "", surfaceAreaMp: "", notes: "",
  address: { ...emptyAddress },
};

// ---------------------------------------------------------------------------
// API record → form values (edit mode)
// ---------------------------------------------------------------------------

type PropertyRow = {
  propertyTypeId:  string | null;
  nickname:        string | null;
  tarlaId:         string | null;
  parcela:         string | null;
  cadastralNumber: string | null;
  carteFunciara:   string | null;
  useCategoryId:   string | null;
  surfaceAreaMp:   string | null;
  notes:           string | null;
};

type AddressRow = {
  streetLine: string | null;
  postalCode: string | null;
  locality:   string | null;
  county:     string | null;
  country:    string;
  notes:      string | null;
  streetViewStreetLine: string | null;
};

export function fromApiPayload(input: {
  property: PropertyRow;
  address:  AddressRow | null;
}): FormValues {
  const p = input.property;
  const a = input.address;
  return {
    propertyTypeId:  p.propertyTypeId  ?? "",
    nickname:        p.nickname        ?? "",
    tarlaId:         p.tarlaId         ?? "",
    parcela:         p.parcela         ?? "",
    cadastralNumber: p.cadastralNumber ?? "",
    carteFunciara:   p.carteFunciara   ?? "",
    useCategoryId:   p.useCategoryId   ?? "",
    surfaceAreaMp:   p.surfaceAreaMp   ?? "",
    notes:           p.notes           ?? "",
    address: a
      ? {
          streetLine: a.streetLine ?? "",
          postalCode: a.postalCode ?? "",
          locality:   a.locality   ?? "",
          county:     a.county     ?? "",
          country:    a.country,
          notes:      a.notes      ?? "",
          streetViewStreetLine: a.streetViewStreetLine ?? "",
        }
      : { ...emptyAddress },
  };
}

// ---------------------------------------------------------------------------
// Form values → API payload
// ---------------------------------------------------------------------------

function blank(s: string): string | null {
  const t = s.trim();
  return t.length > 0 ? t : null;
}

// ---------------------------------------------------------------------------
// hasFormData — true if the user has entered at least one field of data or
// placed at least one corner. Used by the create flow (Slice #15.10) to
// decide whether an untouched "Add new property" form should be treated as
// dirty by the unsaved-changes guard, and whether the Save button should be
// enabled. A freshly-opened, untouched create form must report `false` here
// so navigating away creates no DB row.
// ---------------------------------------------------------------------------

const TOP_LEVEL_TEXT_FIELDS = [
  "propertyTypeId",
  "nickname",
  "tarlaId",
  "parcela",
  "cadastralNumber",
  "carteFunciara",
  "useCategoryId",
  "surfaceAreaMp",
  "notes",
] as const satisfies readonly (keyof Omit<FormValues, "address">)[];

const ADDRESS_TEXT_FIELDS = [
  "streetLine",
  "postalCode",
  "locality",
  "county",
  "country",
  "notes",
  "streetViewStreetLine",
] as const satisfies readonly (keyof AddressBlock)[];

export function hasFormData(values: FormValues, corners: Corner[]): boolean {
  if (corners.length > 0) return true;
  if (TOP_LEVEL_TEXT_FIELDS.some((key) => blank(values[key]) !== null)) return true;
  return ADDRESS_TEXT_FIELDS.some((key) => blank(values.address[key]) !== null);
}

export function toApiPayload(
  values: FormValues,
  corners: Corner[],
): PropertyCreate & PropertyUpdate {
  const addrCountry = blank(values.address.country);

  return {
    propertyTypeId:  blank(values.propertyTypeId),
    nickname:        blank(values.nickname),
    tarlaId:         blank(values.tarlaId),
    parcela:         blank(values.parcela),
    cadastralNumber: blank(values.cadastralNumber),
    carteFunciara:   blank(values.carteFunciara),
    useCategoryId:   blank(values.useCategoryId),
    surfaceAreaMp:   blank(values.surfaceAreaMp) != null
                       ? parseFloat(values.surfaceAreaMp)
                       : null,
    notes: blank(values.notes),
    address: addrCountry
      ? {
          streetLine: blank(values.address.streetLine),
          postalCode: blank(values.address.postalCode),
          locality:   blank(values.address.locality),
          county:     blank(values.address.county),
          country:    addrCountry,
          notes:      blank(values.address.notes),
          streetViewStreetLine: blank(values.address.streetViewStreetLine),
        }
      : null,
    corners: corners.map((c) => ({ lat: c.lat, lon: c.lon, originalIndex: c.originalIndex ?? null })),
  };
}

// ===========================================================================
// Versioning (Slice #18.02) — snapshot conversion + pure diff helpers
//
// A "version" is a full snapshot of the property (fields + address + corners).
// These helpers convert a snapshot into the form's value/corner shapes, and
// derive — purely, by diffing snapshot N against snapshot N-1 — the version
// label colour, the per-field highlight frames, and the corner diff used to
// render per-row red frames and removed-corner red lines. All pure (no React,
// no I/O) so they can be unit-tested directly.
// ===========================================================================

/** A highlight frame colour. green = pure addition; red = modify/delete (and
 *  ALL corner changes, including additions, per the Slice #18.02 spec). */
export type HighlightColor = "green" | "red";

export type FieldHighlights = {
  property: Partial<Record<keyof PropertySnapshotProperty, HighlightColor>>;
  address:  Partial<Record<keyof PropertySnapshotAddress, HighlightColor>>;
};

/** One entry in a corner diff render plan, in display order. `same`/`added`
 *  rows render the curr corner (added rows framed red); `removed` renders a
 *  thick red horizontal line where the deleted corner used to be. */
export type CornerDiffEntry =
  | { type: "same";    corner: Corner }
  | { type: "added";   corner: Corner }
  | { type: "changed"; corner: Corner }
  | { type: "removed" };

// ⚠️ **THE REGISTRY, NOT A COPY OF IT — AND THIS PAIR IS WHY SLICE #34.19 WENT
// LOOKING.** `PROPERTY_SNAPSHOT_PROPERTY_KEYS` and
// `PROPERTY_SNAPSHOT_ADDRESS_KEYS` (src/lib/versioning/snapshot-registry.ts)
// are the single source for a PropertySnapshot's shape, guarded by
// `AssertExactKeys` at compile time and by
// src/__tests__/snapshot-registry.test.ts at run time. The nine literals that
// stood here were annotated `(keyof PropertySnapshotProperty)[]`, which guards
// one direction only — a FOREIGN key would not compile — and says nothing at
// all about a key the list forgot. It had forgotten one: the registry holds
// ten, and the missing one was `calculatedAreaMp`. That is the same absence
// `object-writers-enumerated.test.ts` records for `snapshotsEqual` — its
// header calls it "written into every snapshot and compared in none" — found a
// second time, in a second hand-written list, in the same entity.
//
// ⚠️ **WHAT THE USER SEES IS UNCHANGED, AND THAT IS A STATEMENT ABOUT TWO
// THINGS RATHER THAN A HOPE.**
//   * The FRAMES. `computeFieldHighlights` now returns a `calculatedAreaMp`
//     entry, and nothing renders it: property-form.tsx draws the calculated
//     area with `ReadOnlyField`, which takes no `highlight` prop, while every
//     framed field on that form passes `displayHighlights?.property.<key>`.
//     So the set of fields the version view frames is exactly what it was.
//   * The LABEL COLOUR. `versionLabelColor` below reads this map, so a red on
//     the new key could in principle turn a green version red. It cannot:
//     `calculatedAreaMp` is computed from the corners (lib/properties/
//     corner-geometry.ts), so it differs only when the corners differ, and
//     `cornersChanged` already forces red in that case. A snapshot written
//     before migration_033 carries no such key at all, which reads as
//     null -> value, i.e. green, and green never flips the label.
// Both halves are asserted in src/__tests__/version-diff-registry-bound.test.ts.
const PROPERTY_SNAP_KEYS: readonly (keyof PropertySnapshotProperty)[] =
  PROPERTY_SNAPSHOT_PROPERTY_KEYS;

const ADDRESS_SNAP_KEYS: readonly (keyof PropertySnapshotAddress)[] =
  PROPERTY_SNAPSHOT_ADDRESS_KEYS;

/** Trim, treat "" as unset — same semantics as `blank`. */
function normVal(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Frame colour for one field: green = added, red = modified or deleted. */
function fieldFrame(prev: string | null, curr: string | null): HighlightColor | null {
  const p = normVal(prev);
  const c = normVal(curr);
  if (p === null && c === null) return null;
  if (p === null) return "green";          // null -> value : addition
  if (c === null) return "red";            // value -> null : deletion
  return p === c ? null : "red";           // value -> other value : modification
}

/** Snapshot's property + address → RHF form values (edit/view hydration). */
export function snapshotToFormValues(snap: PropertySnapshot): FormValues {
  return fromApiPayload({ property: snap.property, address: snap.address });
}

/** Snapshot's corners → client Corner[]. */
export function snapshotToCorners(snap: PropertySnapshot): Corner[] {
  return snap.corners.map((c) => ({
    lat: c.lat,
    lon: c.lon,
    originalIndex: c.originalIndex,
  }));
}

/** Per-field highlight frames for `curr` relative to `prev`. Empty for
 *  version 0 (`prev === null`) — nothing to compare against. */
export function computeFieldHighlights(
  prev: PropertySnapshot | null,
  curr: PropertySnapshot,
): FieldHighlights {
  const out: FieldHighlights = { property: {}, address: {} };
  if (!prev) return out;

  for (const k of PROPERTY_SNAP_KEYS) {
    const f = fieldFrame(prev.property[k], curr.property[k]);
    if (f) out.property[k] = f;
  }
  for (const k of ADDRESS_SNAP_KEYS) {
    const pv = prev.address ? prev.address[k] : null;
    const cv = curr.address ? curr.address[k] : null;
    const f = fieldFrame(pv as string | null, cv as string | null);
    if (f) out.address[k] = f;
  }
  return out;
}

function cornerEq(a: Corner, b: Corner): boolean {
  return a.lat === b.lat && a.lon === b.lon;
}

/** True if the two corner sequences differ in any way (length, order, coords,
 *  or originalIndex) — drives the "any corner change → red" label rule. */
export function cornersChanged(prev: Corner[], curr: Corner[]): boolean {
  if (prev.length !== curr.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i].lat !== curr[i].lat || prev[i].lon !== curr[i].lon) return true;
    if ((prev[i].originalIndex ?? null) !== (curr[i].originalIndex ?? null)) return true;
  }
  return false;
}

/**
 * Corner diff (curr vs prev) producing an in-order render plan.
 *
 * When the corner count is unchanged (an in-place coordinate edit and/or a
 * reorder) we diff POSITIONALLY: each index is `same` or `changed` (red), so
 * the row count stays exactly the same — no spurious removed/added rows.
 *
 * When the count differs (a genuine add or removal) we fall back to an LCS
 * diff: matched corners are `same`, corners only in curr are `added` (framed
 * red), corners only in prev are `removed` (rendered as an empty red row at
 * their former position so the table doesn't shrink).
 */
export function computeCornerDiff(prev: Corner[], curr: Corner[]): CornerDiffEntry[] {
  if (prev.length === curr.length) {
    return curr.map((c, i) =>
      cornerEq(prev[i], c)
        ? ({ type: "same", corner: c } as CornerDiffEntry)
        : ({ type: "changed", corner: c } as CornerDiffEntry),
    );
  }

  const n = prev.length;
  const m = curr.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = cornerEq(prev[i], curr[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: CornerDiffEntry[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (cornerEq(prev[i], curr[j])) {
      out.push({ type: "same", corner: curr[j] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "removed" });
      i++;
    } else {
      out.push({ type: "added", corner: curr[j] });
      j++;
    }
  }
  while (i < n) { out.push({ type: "removed" }); i++; }
  while (j < m) { out.push({ type: "added", corner: curr[j] }); j++; }
  return out;
}

/**
 * Version label colour. Version 0 (no predecessor) is always green. Otherwise
 * red if any field was modified or deleted, OR corners changed in any way
 * (including pure additions); green only when the version added field values
 * and left corners untouched.
 */
export function versionLabelColor(
  prev: PropertySnapshot | null,
  curr: PropertySnapshot,
): HighlightColor {
  if (!prev) return "green";

  const fh = computeFieldHighlights(prev, curr);
  const anyRedField =
    Object.values(fh.property).some((c) => c === "red") ||
    Object.values(fh.address).some((c) => c === "red");
  if (anyRedField) return "red";

  if (cornersChanged(snapshotToCorners(prev), snapshotToCorners(curr))) return "red";
  return "green";
}

/** True when two form-value sets are equal field-by-field (empty == ""). Used
 *  by edit mode to decide whether the latest working copy differs from the
 *  loaded baseline — independent of RHF's reset-sensitive `isDirty`. */
export function formValuesEqual(a: FormValues, b: FormValues): boolean {
  for (const k of TOP_LEVEL_TEXT_FIELDS) {
    if (normVal(a[k]) !== normVal(b[k])) return false;
  }
  for (const k of ADDRESS_TEXT_FIELDS) {
    if (normVal(a.address[k]) !== normVal(b.address[k])) return false;
  }
  return true;
}

// ===========================================================================
// A version's lookup values, and what can be done with them   (Slice #34.17)
//
// The three fields below store a row of an admin-managed list. `dependents.ts`
// decides on purpose that a version snapshot is NOT a dependent, so an admin
// may delete a row that only a snapshot still names — and every snapshot
// written before migration_078 holds the tarla as the CODE in text under
// `tarlaSola`, with no id at all, because Slice #34.03 deliberately did not
// rewrite them. Both used to render as an empty box on the version view.
//
// ⚠️ **THE `isOnLatest` GATE IS IN HERE RATHER THAN AT THE CALL SITE, AND THAT
// IS THE POINT.** It is the one condition whose failure is invisible in a test
// of the resolver: drop it and the LIVE, EDITABLE row would print „valoare
// ștearsă" over a picker the user is allowed to change. Pure and exported, so
// that condition is a unit test rather than a source-reading guard.
// ===========================================================================

/** The three property fields whose stored value is a row of a lookup list. */
export type PropertyLookupField = "propertyTypeId" | "useCategoryId" | "tarlaId";

export type PropertyLookupStates = Record<PropertyLookupField, SnapshotLookupState>;

/**
 * A FRESH object every time, not a shared constant.
 *
 * ⚠️ A review round found a module-level singleton here, frozen — SHALLOWLY, so
 * the three members inside it stayed writable. One stray mutation would have
 * corrupted every later call in the tab, and it would have landed on the LATEST
 * version: "Make current" refused for ever, naming a field that is perfectly
 * fine. Three object literals per render is not a cost worth reasoning about;
 * a process-wide singleton is.
 */
function nothingRecorded(): PropertyLookupStates {
  return {
    propertyTypeId: { kind: "empty" },
    useCategoryId:  { kind: "empty" },
    tarlaId:        { kind: "empty" },
  };
}

/**
 * What the VIEWED version recorded in each of the three lookup fields.
 *
 * `isOnLatest` short-circuits everything to `empty`: the latest version IS the
 * live row, and all three columns are `ON DELETE SET NULL`, so deleting a
 * lookup row blanks them there rather than stranding an id — the live copy
 * cannot reach `deleted`, and a label printed over an editable picker would be
 * both wrong and unchangeable.
 *
 * Each option list is the assembled array the form renders, or `undefined`
 * while its query has not resolved. That distinction is the difference between
 * "the list holds no such row" and "the list has not been read yet"; see
 * `snapshot-lookup.ts`.
 */
export function snapshotLookupStates(input: {
  snapshot:       PropertySnapshot | undefined;
  isOnLatest:     boolean;
  propertyTypes:  readonly SnapshotLookupOption[] | undefined;
  useCategories:  readonly SnapshotLookupOption[] | undefined;
  tarla:          readonly SnapshotLookupOption[] | undefined;
}): PropertyLookupStates {
  if (input.isOnLatest || !input.snapshot) return nothingRecorded();
  const p = input.snapshot.property;
  return {
    propertyTypeId: resolveSnapshotLookup({ id: p.propertyTypeId, options: input.propertyTypes }),
    useCategoryId:  resolveSnapshotLookup({ id: p.useCategoryId,  options: input.useCategories }),
    // The only one of the three with a third state to answer.
    tarlaId: resolveSnapshotLookup({
      id:           p.tarlaId,
      recordedText: snapshotRecordedText(p, "tarlaSola"),
      options:      input.tarla,
    }),
  };
}

const FIELD_ORDER: PropertyLookupField[] = ["propertyTypeId", "useCategoryId", "tarlaId"];

/**
 * The fields that make "Make this version current" IMPOSSIBLE, in display order.
 *
 * "Make current" re-saves `form.getValues()` — the values `snapshotToFormValues`
 * put on the form when the version was opened, which is the snapshot's own
 * content. A `deleted` id is still among them and its column is a foreign key,
 * so the PATCH comes back 23503 and `dbErrorToResponse` hands the user the
 * string „Foreign key violation", in English. So the press is REFUSED, in a
 * single-button dialog that NAMES the fields — not by greying the button out,
 * which puts the reason in a `title` on a control that is out of the tab order
 * and unannounced. Naming them is the point: the field that blocks may not
 * even be on screen, since `hideTarlaParcela` removes the tarla for urban
 * property types.
 *
 * ⚠️ **`recorded` DOES NOT BLOCK, AND THE FIRST DRAFT OF THIS SLICE HAD IT
 * BLOCKING — a review round showed that was worse than what it prevented.**
 * A pre-migration_078 version has no tarla id, so `snapshotToFormValues` puts
 * `""` on the form and `toApiPayload` sends `null`: the restore drops the tarla
 * whatever the screen says, and it did so before this slice too, when the box
 * was merely empty. Blocking would have taken the ONLY one-click route back to
 * a whole population of versions — their corners, areas, notes and nickname —
 * to protect one field that cannot be carried either way. It is disclosed in
 * the confirmation dialog instead; see `restoreDropsRecorded`.
 *
 * `pending` never blocks: an unread list is not evidence of anything. ⚠️ **It
 * usually resolves in one round trip, and it does NOT always** — a value-list
 * fetch that keeps failing leaves the query's data `undefined` for as long as
 * the failure lasts, and in that window a deleted row is indistinguishable from
 * an unread one, so a restore can still reach the 23503 this function exists to
 * prevent. Refusing on `pending` would be worse: it would take every restore
 * away for the same window, on evidence nobody has read. The window is in the
 * #34.17 handover. `handleMakeCurrent` re-checks this predicate for the
 * narrower case it CAN close: a list that resolves while the confirmation
 * dialog is open.
 */
export function restoreBlockedBy(states: PropertyLookupStates): PropertyLookupField[] {
  return FIELD_ORDER.filter((f) => states[f].kind === "deleted");
}

/**
 * The fields whose value a restore would drop, in display order.
 *
 * Only `recorded` — text the snapshot holds with no id to carry it back. Says
 * so in the confirmation dialog, so the one field that will not survive is
 * named before the press rather than missed afterwards.
 */
export function restoreDropsRecorded(states: PropertyLookupStates): PropertyLookupField[] {
  return FIELD_ORDER.filter((f) => states[f].kind === "recorded");
}

/** Props for the version navigation controls rendered on the corners-line. */
export type VersionNav = {
  current: number;
  color:   HighlightColor;
  canPrev: boolean;
  canNext: boolean;
  onPrev:  () => void;
  onNext:  () => void;
  // "Make this version current" — enabled only on a past version (disabled on
  // the latest). Restores the viewed snapshot as a new version.
  canMakeCurrent: boolean;
  onMakeCurrent:  () => void;
};
