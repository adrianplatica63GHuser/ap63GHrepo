/**
 * What a version's stored lookup value means TODAY.             (Slice #34.17)
 *
 * WHY THIS EXISTS
 * ---------------
 * A version snapshot holds lookup ids inside `jsonb`, with no foreign key, and
 * `src/lib/admin/value-lists/dependents.ts` decides ON PURPOSE that snapshots
 * do not count as dependents — a version is a record of what was true when it
 * was saved, so re-pointing it would rewrite history and deleting it would
 * destroy history. The consequence is deliberate and it is visible: an admin
 * may delete a lookup row that only a snapshot still names, and paging back to
 * that version then showed an EMPTY BOX with nothing to explain it.
 *
 * The live columns cannot reach that state — all three property lookups are
 * `ON DELETE SET NULL`, and a row that real objects still point at is refused
 * by the dependent COUNT in `dependents.ts` before any of that (`dependentNotes`
 * beside it only prints the sentence saying snapshots are not in the count) —
 * so this is a snapshot-only problem, and the fix belongs on the version view
 * rather than in the picker. ⚠️ **It is NOT `optionsWithUnlisted-
 * Values` coming back.** That function (deleted in Slice #34.03 with the
 * `allowUnlistedValue` prop) synthesised an `<option>` inside a LIVE picker,
 * so a value the list did not hold stayed selectable and could be saved back.
 * Nothing here is selectable and nothing here is written: the version view
 * prints a value INSTEAD of offering a picker.
 *
 * THREE STATES, NOT TWO
 * ---------------------
 * Slice #34.03 turned `property.tarla_sola` (free TEXT) into `property.tarla_id`
 * (an FK) and deliberately did not rewrite `property_version.snapshot`, so the
 * snapshots written before it still carry `tarlaSola` — the code as text, with
 * no id to resolve it to. That is a different shape of the same empty box, and
 * it is permanent for every one of those versions. So a snapshot's stored
 * lookup value is one of:
 *
 *   `resolved`  an id the list still offers            → print the row's label
 *   `deleted`   an id the list no longer offers        → print "valoare ștearsă"
 *   `recorded`  text the snapshot holds itself         → print the text verbatim
 *
 * plus two states that must NOT be labelled at all:
 *
 *   `empty`     the snapshot recorded nothing          → the picker's "none"
 *   `pending`   the list has not been read yet         → the picker, unchanged
 *
 * ⚠️ **`pending` HANDS THE FIELD BACK TO THE PICKER — it does not print
 * anything of its own, and a review round was right to say an earlier version
 * of this paragraph implied otherwise.** So on a cold query cache a historical
 * version's lookup field shows the picker's blank for the length of one round
 * trip and then settles — either into the option, or into „valoare ștearsă".
 * That blank is what every field on this form has shown while its list loaded
 * since Slice #32.13; what `pending` buys is only that the transient is a
 * blank rather than a WRONG SENTENCE, which is a state nothing else here can
 * recover from once a user has read it.
 *
 * ⚠️ **`pending` IS THE LOAD-BEARING ONE.** The option lists arrive from
 * `useQuery` and are `undefined` until they resolve — and stay `undefined` when
 * the fetch FAILS. Treating "not in the list" as "deleted" without that
 * distinction would label every historical lookup on the page „valoare ștearsă"
 * for as long as the list was unread, which is a confident sentence measured
 * against nothing. Callers pass the QUERY's data (`undefined` while unread),
 * not the assembled option array, which is never undefined because
 * `noneOption` is prepended to it unconditionally.
 *
 * ⚠️ **AND AN EMPTY-BUT-LOADED LIST IS A REAL `deleted`, WHICH IS ONLY SAFE
 * BECAUSE OF SLICE #34.04.** A list that read back as `[]` used to be
 * reachable without anybody deleting anything: an expired session answered the
 * value-list fetch with a redirect to the login page, whose HTML parsed to
 * `{}`, and `body.items ?? []` cached that as a successful empty array. The
 * forms now reject `res.redirected` as well as `!res.ok`, so an unreadable list
 * throws and lands in `pending` instead. If a fourth form ever adopts this
 * helper, check its fetcher for that guard before trusting `[]`.
 *
 * ⚠️ **`recorded` AND `resolved` PRINT DIFFERENT STRINGS FOR THE SAME TARLA,
 * DELIBERATELY.** The tarla picker labels a row `indicativ — descriere`, while
 * a pre-#34.03 snapshot recorded the `indicativ` ALONE, because that is all the
 * old TEXT column ever held. So the boundary pair migration_078 leaves on every
 * property — the last legacy version and the first one saved after it — shows
 * "T47/2" then "T47/2 — Lunca Mare". Resolving the old text against today's
 * list would fix the spelling and break the promise: a version would start
 * reading the CURRENT name of a row it never named, which is precisely what
 * #34.03 refused when it declined to rewrite `property_version.snapshot`.
 *
 * ⚠️ **AND THE FRAME OVER THAT PAIR IS GREEN, WHICH READS AS "added" — MEASURED,
 * because an earlier draft of this paragraph guessed "changed".**
 * `computeFieldHighlights` compares `tarlaId` alone: `null → uuid` is an
 * addition, so the second of the pair is framed as if the tarla had just been
 * entered, over a predecessor that now visibly shows one. Same root as
 * migration_078's accepted "one version per property whose diff shows the tarla
 * field changing", and the diff is blind in the other direction too — two
 * legacy versions whose `tarlaSola` text differs get NO frame at all, because
 * `PROPERTY_SNAP_KEYS` has never contained that key. Both are in the #34.17
 * handover under "Noticed, not fixed"; neither is fixable without either
 * rewriting snapshots or teaching the pure diff to resolve ids, and #34.03
 * refused the first.
 *
 * Pure — no React, no I/O, no database — so every state above is unit-tested
 * directly in `src/__tests__/snapshot-lookup.test.tsx`.
 */

/** One entry of a picker's option list: `{ value, label }`. */
export type SnapshotLookupOption = { value: string; label: string };

export type SnapshotLookupState =
  /** The snapshot recorded no value for this field. */
  | { kind: "empty" }
  /** The option list has not been read yet (or could not be read). */
  | { kind: "pending" }
  /** The id is still a row in the list; `label` is that row's current label. */
  | { kind: "resolved"; label: string }
  /** The id is not in the list: the row it named has been deleted. */
  | { kind: "deleted" }
  /** The snapshot holds TEXT that was never an id — nothing to resolve. */
  | { kind: "recorded"; text: string };

/** Trim, and treat "" as unset — the same semantics as `blank`/`normVal`. */
function trimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/**
 * A key a snapshot may still carry that is NOT in its current type.
 *
 * The one caller is the tarla field, reading `tarlaSola` off snapshots written
 * before migration_078. `snapshot-registry.ts` holds the CURRENT key set and
 * `AssertExactKeys` keeps it exact, so an old key is by definition absent from
 * the type — which is why this takes `unknown` and reads defensively rather
 * than casting a snapshot to a shape TypeScript would then believe.
 */
export function snapshotRecordedText(source: unknown, key: string): string | null {
  if (source === null || typeof source !== "object") return null;
  return trimmed((source as Record<string, unknown>)[key]);
}

/**
 * Classify one snapshot lookup value against the list that would offer it.
 *
 * `options` is the QUERY's data: `undefined` means unread (→ `pending`), `[]`
 * means read and empty (→ `deleted` for any id). See the header for why that
 * distinction is the whole point.
 *
 * An id WINS over a recorded text when a snapshot somehow carries both. No
 * writer produces both — `tarlaSola` stopped being written the moment `tarlaId`
 * started — so this is a tie-break for a shape that does not exist rather than
 * a rule with a caller; it is stated because "id, then text" is the only order
 * that keeps `recorded` meaning "was never an id at all".
 */
export function resolveSnapshotLookup(input: {
  id: string | null | undefined;
  /** Text the snapshot recorded itself, for a field that predates its id. */
  recordedText?: string | null;
  /** The option list, or `undefined` while it is unread. */
  options: readonly SnapshotLookupOption[] | undefined;
}): SnapshotLookupState {
  const id = trimmed(input.id);
  if (id === null) {
    const text = trimmed(input.recordedText);
    return text === null ? { kind: "empty" } : { kind: "recorded", text };
  }
  if (input.options === undefined) return { kind: "pending" };
  const hit = input.options.find((o) => o.value === id);
  return hit ? { kind: "resolved", label: hit.label } : { kind: "deleted" };
}

/**
 * True when the version view must PRINT a value instead of offering the picker.
 *
 * `resolved` is not in here on purpose: an id the list still offers is an
 * ordinary option, and the picker showing it selected is both correct and the
 * behaviour every version has had since Slice #18.02. Only the two states the
 * picker cannot represent take the field over.
 */
export function snapshotReplacesPicker(state: SnapshotLookupState): boolean {
  return state.kind === "deleted" || state.kind === "recorded";
}
