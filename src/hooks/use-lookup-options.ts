// src/hooks/use-lookup-options.ts
//
// The Reference Data lists that are read from OUTSIDE Reference Data and feed
// a plain <select>: `lookup_citizenship`, `lookup_person_type`, and — since
// Slice #34.04 — `lookup_person_role`, filtered by the two booleans that used
// to be whitelist tables.
//
// WHY THIS FILE EXISTS
//   These lists were read through a bare `useEffect` + `fetch`, or through a
//   bare React Query key of their own, and the hook was written five times.
//   `useCitizenshipOptions` was character-for-character identical in
//   `natural-person-form.tsx` and `id-card-person-dialog.tsx`;
//   `usePersonTypeOptions` was the same body with one URL changed; and the
//   four association screens each carried their own `fetchRoles` against a
//   whitelist endpoint.
//
//   ⚠️ **THE KEY IS `["value-list", <listKey>]`, AND THAT IS THE WHOLE POINT.**
//   `invalidateListCaches` (`value-list-modal.tsx`) opens with an
//   unconditional `qc.invalidateQueries({ queryKey: ["value-list", listKey] })`
//   — so a list read under that key needs NO branch, no entry in the
//   `BARE_KEYS` table, and no second name for one endpoint. It is the pattern
//   `property-form.tsx` and `judicial-person-form.tsx` have used since Slice
//   #15.16, and its comment states the rule: use the same key the admin modal
//   invalidates on save and delete, and the dropdown stays in sync "without any
//   extra cross-invalidation".
//
//   ⚠️ **Slice #34.04 corrected its own item 7 here.** That item put these two
//   lists on BARE keys — `["citizenships"]`, `["person-types"]` — and added two
//   branches to `invalidateListCaches` to reach them. The branches were exactly
//   the extra cross-invalidation the paragraph above says is unnecessary, and
//   the same slice then had to delete three MORE bare keys for the same reason.
//   Both branches and both `BARE_KEYS` rows are gone again; the keys are
//   namespaced, and the caches are now shared with the Reference Data modal
//   rather than merely invalidated alongside it.
//
//   ⚠️ **THE CACHE HOLDS THE RAW ROWS. THE MAPPING IS A `select`.** One key
//   must mean one shape, and `["value-list", "person-roles"]` is already held
//   by the Reference Data modal as the API's `items` array. `select` transforms
//   per observer without touching what is cached, so the modal and these hooks
//   share one entry and each reads what it needs. Doing it in the `queryFn`
//   instead is precisely the defect this slice was written to remove:
//   `["person-person-roles"]` was one key over two row shapes, and whichever
//   component mounted first decided what the other one got.
//
// ⚠️ **A FIRST LOAD THAT DOES NOT ARRIVE IS SOMETHING THE USER CAN SEE, AND
//   THAT IS THE POINT RATHER THAN A SIDE EFFECT.** Failed, refused, or paused
//   because the browser is offline — see `lookupListState` for why the last of
//   those had to be folded in rather than left as „loading". The hooks this
//   replaced answered a failed GET with an empty array, so an unreadable list
//   and an empty archive rendered identically: a select holding only „—", or a role
//   dropdown with nothing in it and no way to tell "no roles are ticked" from
//   "the list could not be read".

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { CarriedRoleKind } from "@/lib/admin/value-lists/carried-roles";
import {
  withCarriedRoles,
  type PickerRoleOption,
} from "@/lib/admin/value-lists/carried-roles-merge";

export type LookupOption = { value: string; label: string };

/** Which of the three states the list is in, for the hint under the select. */
export type LookupListState = "loading" | "loaded" | "failed";

export type LookupOptions = {
  options: LookupOption[];
  listState: LookupListState;
  /**
   * Read the list again, now.                                  (Slice #34.13)
   *
   * ⚠️ **A FAILED FIRST LOAD DOES NOT HEAL ON ITS OWN, AND NOTHING SAID SO.**
   * `refetchOnWindowFocus` is off globally and `retry` is spent inside the
   * first load, so „failed" lasts until the observer next MOUNTS — close and
   * reopen, or reload the page. On the ID-card review dialog that is not a
   * recovery a user can reach: the dialog is opened BY the import run, one
   * card after another, and closing it is recorded as a decision not to create
   * the person. So the sentence under the field now comes with a way out of
   * the state it describes.
   *
   * ⚠️ **On every hook rather than only the one that needed it.** One shape,
   * one meaning: an optional `reload` would make every caller ask whether this
   * particular list can be re-read, and the answer is always yes — they are all
   * `useQuery` over the same endpoint family. `useInstitutionOptions` in
   * `id-card-person-dialog.tsx` has carried a `reload` under that exact name
   * since #34.02, and this is the same verb for the same act.
   *
   * Fire-and-forget: React Query owns the outcome, and it lands in `options`,
   * `listState` and `isReloading` like any other read. Nothing awaits it.
   */
  reload: () => void;
  /**
   * Is a read in flight right now?                             (Slice #34.13)
   *
   * ⚠️ **`listState` CANNOT ANSWER THIS, AND THAT IS WHY IT EXISTS.** A
   * `refetch` of a query already in `error` leaves `status` at `"error"` for
   * the whole round trip, so `listState` stays „failed" from the click until
   * the answer — and a retry that fails twice moves nothing on screen at all.
   * A control that gives no sign it was pressed is the „did that do anything?"
   * state `institutionAdding` exists to avoid one dialog over.
   *
   * ⚠️ **A PAUSED read counts as in flight, unless it is the FIRST one.** In
   * practice that means a retry of a query that already failed — the only
   * paused read any caller renders a control for — though a paused background
   * refetch of a successful query reports too, harmlessly and correctly.
   * React Query pauses a read it cannot start
   * (`networkMode: "online"`), so a retry pressed after a failure while the
   * machine is off the network never reaches `"fetching"`: a flag gated on that
   * alone leaves the label „Reîncearcă" with nothing moving, which is the
   * silence this member exists to remove. Paused means „taken, and it will
   * run", and React Query resumes it on its own.
   *
   * ⚠️ **`&& !isPending` is what keeps it from lying on a FIRST load, and it
   * leaves one state uncovered on purpose.** A first read attempted offline is
   * `isPending` AND `"paused"` — and `lookupListState` reports that pair as
   * „failed", so the retry control renders. Without the clause it would render
   * already disabled and already saying „Se reîncearcă…", announcing an action
   * nobody has taken. The cost is that pressing it there changes nothing on screen:
   * `refetch()` on a pending-paused query stays pending-paused. That is the
   * honest reading — React Query never stopped trying the first load, so there
   * is no new attempt to report — and widening the flag to cover it would
   * bring the lie back for every offline mount, which is the commoner event.
   */
  isReloading: boolean;
};

/** The columns of `lookup_person_role` these hooks read. */
type PersonRoleRow = {
  id: string;
  name: string;
  validForProperty: boolean;
  validForPerson: boolean;
};

type NamedRow = { id: string; name: string };

/**
 * ⚠️ **`res.redirected` as well as `!res.ok`.** An expired session answers
 * with a redirect to the login page, and that HTML parses to `{}` — which
 * `data.items ?? []` then reads as "the archive holds none". `fetchInstitutions`
 * in `id-card-person-dialog.tsx` checks the same thing for the same reason.
 * Throwing is what puts React Query into an error state, which is what the
 * caller renders.
 */
async function fetchValueList<T>(list: string): Promise<T[]> {
  const res = await fetch(`/api/admin/value-lists/${list}`);
  if (res.redirected || !res.ok) throw new Error(`Failed to load ${list} (HTTP ${res.status})`);
  const data = (await res.json()) as { items?: T[] };
  return data.items ?? [];
}

const toOptions = (rows: NamedRow[]): LookupOption[] =>
  rows.map((r) => ({ value: r.id, label: r.name }));

/**
 * ⚠️ **One frozen empty array rather than a fresh `[]` per render.**
 * (Slice #34.13.) `options: data ?? []` handed every caller a new identity on
 * every render for as long as the list was loading or failed — which puts a
 * changing value into the dependency array of anything that closes over it, and
 * quietly defeats the React Compiler memoization these call sites are otherwise
 * careful to keep. The empty case is exactly the one where nothing can differ.
 *
 * ⚠️ **NOT `Object.freeze`d, and a review round is why.** A frozen array handed
 * out as a mutable `LookupOption[]` is a type that says „you may push to this"
 * over a value that throws when you do — and it would throw only on the
 * loading/failed path, which is the one path this whole file exists to make
 * safe. The type would have to become `readonly` for the freeze to be honest,
 * and that is a change to every caller for a mutation none of them makes.
 */
const NO_OPTIONS: LookupOption[] = [];

/**
 * ⚠️ **`isLoadingError`, NOT `isError`, and an adversarial round is why.**
 * `isError` is also true for a failed BACKGROUND refetch, where `data` from the
 * last successful read is still being rendered. With a 30 s staleTime and
 * `refetchOnMount` at its default, that is an ordinary Tuesday: open the form,
 * the cached list renders complete and working, the refetch fails, and a red
 * line appears under a full dropdown saying the list could not be read. On the
 * ID-card dialog the sentence would be literally false on screen — it says the
 * field shows „—" while the field shows the citizenship. `isLoadingError` is
 * `isError && !hasData` (measured in @tanstack/react-query's
 * `queryObserver.js`), which is what „failed" is meant to mean here: there is
 * no list.
 *
 * ⚠️ **The consequence, stated rather than left to be found: a failed REFETCH
 * is silent, and a stale list can outlive the row it names.** Delete a
 * citizenship in Reference Data, let the invalidation fire, and if that refetch
 * fails the select goes on offering the deleted row with nothing said. That is
 * the lesser of the two wrongs — the alternative is a red line under a working
 * dropdown on every flaky refetch — and it is what `isRefetchError` exists to
 * treat differently if it ever earns its own quieter hint. It is not an
 * oversight.
 *
 * ⚠️ **`paused` counts as failed, and offline is why.** React Query's
 * `networkMode` pauses a query it cannot start: `fetchStatus` goes to
 * `"paused"` and `status` stays `"pending"` — so a first load attempted while
 * the browser is offline is `isPending` true, `isLoadingError` false, for as
 * long as the machine stays offline. Read as „loading" that is a silent empty
 * select, which is exactly the behaviour this file exists to remove, arrived at
 * from the other side, in the failure a laptop user is most likely to hit.
 * There IS no list and it is not on its way, so it is reported as failed; when
 * the connection returns React Query resumes on its own and the line goes away.
 */
/*
 * ⚠️ **EXPORTED BY SLICE #34.15, AND THE EXPORT IS THE POINT RATHER THAN A
 * CONVENIENCE.** Three role-handling screens do not read their list through a
 * hook in this file — „Asociază persoană" from a document reads
 * `/api/documents/[id]/valid-person-roles` directly, and the two „Asociază
 * document" screens read one of two lists depending on how many documents are
 * ticked — so before this they had no way to say „the list could not be read"
 * without deciding for themselves what „could not be read" means. A second
 * definition would be a second answer: the three paragraphs above are why
 * `isLoadingError` rather than `isError`, and why `paused` counts as failed,
 * and a screen that reached for the obvious `isError` would print the sentence
 * under a full dropdown on every flaky refetch. One function, one meaning,
 * whether the caller uses the hooks or its own `useQuery`.
 */
export function lookupListState(
  isPending: boolean,
  isLoadingError: boolean,
  fetchStatus: "fetching" | "paused" | "idle",
): LookupListState {
  if (isLoadingError) return "failed";
  if (isPending && fetchStatus === "paused") return "failed";
  return isPending ? "loading" : "loaded";
}

/**
 * ⚠️ **`retry: 1` rather than the client default of 3.** Measured against
 * `defaultRetryDelay(n) = Math.min(1000 * 2 ** n, 30000)`: the default is four
 * GETs and 1 + 2 + 4 = 7 seconds of backoff before the user is told anything,
 * against the one GET and instant (silent) failure this replaces. Nothing
 * renders `"loading"`, so those seven seconds are a blank select with no
 * explanation — the state this whole change exists to remove, arrived at from
 * the other side. One retry covers the dropped packet and puts the sentence on
 * screen inside two round trips and a second. These are reference lists on a
 * LAN — eight citizenships, seven person types and 56 roles in the seed — not
 * a flaky third party.
 *
 * ⚠️ **Not a guarantee on a SHARED key, which an adversarial round pointed
 * out.** React Query stores options per QUERY, not per observer, so on
 * `["value-list", "person-roles"]` — also observed by the Reference Data list
 * modal and by „Persoană → Document", neither of which sets `retry` — the last
 * observer to mount decides the budget. In practice those two are admin modals
 * and these hooks are on association pages and entity forms, so they rarely
 * coexist; where they do, the cost is the client default, which is what every
 * other dropdown in the app already gets.
 */
const LOOKUP_QUERY_RETRY = 1;

/**
 * ⚠️ **Module-level rather than inline, because `select` runs on every render
 * whose function identity changed.** Two stable references cost nothing and
 * keep the filter out of the `queryFn`, which is where it would become a
 * second shape under one key.
 */
const PERSON_ROLE_SELECT = {
  property: (rows: PersonRoleRow[]) => toOptions(rows.filter((r) => r.validForProperty)),
  person:   (rows: PersonRoleRow[]) => toOptions(rows.filter((r) => r.validForPerson)),
} as const;

/**
 * `lookup_citizenship`, for the Citizenship select on the natural-person form
 * and on the ID-card review dialog.
 */
export function useCitizenshipOptions(): LookupOptions {
  const { data, isPending, isLoadingError, fetchStatus, refetch } = useQuery({
    queryKey: ["value-list", "citizenships"],
    queryFn:  () => fetchValueList<NamedRow>("citizenships"),
    select:   toOptions,
    retry:    LOOKUP_QUERY_RETRY,
  });
  const reload = useCallback((): void => {
    void refetch();
  }, [refetch]);
  return {
    options: data ?? NO_OPTIONS,
    listState: lookupListState(isPending, isLoadingError, fetchStatus),
    reload,
    isReloading: fetchStatus === "fetching" || (fetchStatus === "paused" && !isPending),
  };
}

/** `lookup_person_type` — the „Tip Profesional" select (Slice #18.16.VL). */
export function usePersonTypeOptions(): LookupOptions {
  const { data, isPending, isLoadingError, fetchStatus, refetch } = useQuery({
    queryKey: ["value-list", "person-types"],
    queryFn:  () => fetchValueList<NamedRow>("person-types"),
    select:   toOptions,
    retry:    LOOKUP_QUERY_RETRY,
  });
  const reload = useCallback((): void => {
    void refetch();
  }, [refetch]);
  return {
    options: data ?? NO_OPTIONS,
    listState: lookupListState(isPending, isLoadingError, fetchStatus),
    reload,
    isReloading: fetchStatus === "fetching" || (fetchStatus === "paused" && !isPending),
  };
}

/**
 * The person roles a given kind of association may be tagged with.
 *                                                              (Slice #34.04)
 *
 * `validFor: "property"` is the dropdown on the three Proprietate ↔ Persoană
 * association screens; `"person"` is the one on Persoană ↔ Persoană. Both read
 * the master role list and filter on the boolean that replaced a whitelist
 * table — `lookup_person_role.valid_for_property` / `.valid_for_person`,
 * migration_079.
 *
 * ⚠️ **This is where the fixed defect was.** Before the collapse, the two sides
 * had their own endpoints and their own keys, and the person side's key
 * (`["person-person-roles"]`) was shared by the „Persoană → Persoană" admin
 * modal, which cached the SAME endpoint's raw rows under it. React Query serves
 * one entry per key, so whichever mounted first won for the 30 s staleTime:
 * mount the modal first and the association screen rendered blank `<option>`
 * labels and, on selection, submitted a `lookup_person_person_role.id` into
 * `person_person.relationship_role_id`, where it is a 23503. Both the second
 * endpoint and the second cache name are gone; the id in the `<option>` is a
 * `lookup_person_role.id` because there is no other kind of id left.
 *
 * ⚠️ **`validFor` is not part of the query key, deliberately.** Both sides read
 * the same list; only the filter differs, and that filter is a `select`. A key
 * per side would mean two cache entries over one endpoint — the „two names for
 * one list" this slice deleted, rebuilt one layer down.
 */
export function usePersonRoleOptions(validFor: "property" | "person"): LookupOptions {
  const { data, isPending, isLoadingError, fetchStatus, refetch } = useQuery({
    queryKey: ["value-list", "person-roles"],
    queryFn:  () => fetchValueList<PersonRoleRow>("person-roles"),
    select:   PERSON_ROLE_SELECT[validFor],
    retry:    LOOKUP_QUERY_RETRY,
  });
  const reload = useCallback((): void => {
    void refetch();
  }, [refetch]);
  return {
    options: data ?? NO_OPTIONS,
    listState: lookupListState(isPending, isLoadingError, fetchStatus),
    reload,
    isReloading: fetchStatus === "fetching" || (fetchStatus === "paused" && !isPending),
  };
}

// ── The role a row already carries ───────────────────────────────────────────
//
// ⚠️ **`import type`, and it has to stay that way.**
// `@/lib/admin/value-lists/carried-roles` imports `@/db`, which opens a pg
// Pool. A type import is erased at compile time and reaches no bundle; turning
// it into a value import — for `CARRIED_ROLE_KINDS`, say — would pull the
// database client into every association screen.

/**
 * ⚠️ **A failed read here is SILENT, on purpose.** The offered list already
 * has `roleListUnavailable` for "there is no list"; this is a second read that
 * can only ever ADD entries, so its failure degrades to the picker exactly as
 * it behaved before Slice #34.05 — the whitelist's roles and nothing more.
 * A second red line under a working dropdown, for a list the user never asked
 * for by name, would cost more than it explains.
 */
async function fetchCarriedRoles(kind: CarriedRoleKind, entityId: string): Promise<NamedRow[]> {
  const params = new URLSearchParams({ kind, entityId });
  const res = await fetch(`/api/person-roles/carried?${params.toString()}`);
  if (res.redirected || !res.ok) throw new Error(`Failed to load carried roles (HTTP ${res.status})`);
  const data = (await res.json()) as { items?: NamedRow[] };
  return data.items ?? [];
}

/**
 * The picker's whole option list: what the whitelist OFFERS, plus what this
 * entity's own association rows already CARRY.               (Slice #34.05)
 *
 * `offered` is passed in rather than fetched here because there is no single
 * answer to "which roles are offered": the Proprietate ↔ Persoană screens read
 * `validForProperty`, „Persoană ↔ Persoană" reads `validForPerson`, and the
 * document side reads the document type's whitelist. Only the screen knows;
 * this hook supplies the second source and the subtraction.
 *
 * `entityId` is the entity the screen is about — the property on
 * „Asociază persoană", the person on „Asociază proprietate", the document on
 * „Asociază persoană" from a document. See `carried-roles.ts` for why it is
 * never global.
 *
 * ⚠️ **`offered` AND `entityId` MUST BE SCOPED TO THE SAME THING, AND THAT IS
 * WHAT DECIDES WHERE THIS HOOK CAN BE USED AT ALL.** The mark says "the archive
 * carries this role and this list no longer offers it" — a true sentence only
 * when a role missing from `offered` really is withdrawn for the thing
 * `entityId` names. The two person-side „Asociază document" screens fail that
 * test and deliberately do not call this: their `offered` is the SELECTED
 * DOCUMENT TYPE's whitelist while the row a role could be carried on is a
 * (person, document) pair that does not exist yet, so a person-scoped answer
 * would mark „Vânzător" unavailable on a cadastral plan — where it is not
 * withdrawn, merely not a party to that kind of document — and a
 * document-scoped one would print roles belonging to OTHER people, on a screen
 * that shows none of their rows. Two adversarial rounds landed on that; the
 * handover says what it would take.
 *
 * `offeredIsKnown` is the caller's answer to "has the offered list arrived" —
 * `listState === "loaded"` on the four hook screens, `data !== undefined` on
 * the document side. It gates the union; the paragraph inside says why.
 */
export function useRoleOptionsWithCarried(
  offered: readonly LookupOption[],
  kind: CarriedRoleKind,
  entityId: string,
  offeredIsKnown: boolean,
): PickerRoleOption[] {
  const t = useTranslations("shared");
  const { data } = useQuery({
    // ⚠️ **UNDER `["value-list", "person-roles"]`, AND THAT IS THE WHOLE
    // INVALIDATION STORY.** `invalidateListCaches` opens with an unconditional
    // `invalidateQueries({ queryKey: ["value-list", listKey] })`, and React
    // Query matches by PREFIX — so a role renamed or deleted in Reference Data
    // reaches this cache too, with no branch, no `BARE_KEYS` row and no second
    // name for one list. A bare `["carried-person-roles", …]` would need a
    // branch, which is the extra cross-invalidation the docblock at the top of
    // this file says is unnecessary and which #34.04 deleted three of. The
    // trailing segments make it a different ENTRY, never a second shape under
    // the same key.
    queryKey: ["value-list", "person-roles", "carried", kind, entityId],
    queryFn:  () => fetchCarriedRoles(kind, entityId),
    select:   toOptions,
    retry:    LOOKUP_QUERY_RETRY,
    // ⚠️ **`staleTime: 0`, against the client default of 30 s, and a dissociate
    // is why.** Nothing invalidates this entry when an ASSOCIATION changes —
    // the dissociate handlers invalidate `["property-persons", propertyId]` and
    // its five siblings, not this — so a cached answer can go on naming a role
    // the last row carrying it has just been removed from. Every observer of
    // this key is an association screen the user has just navigated to, so
    // „refetch on mount" is one small GET per screen open, and it is the only
    // thing that makes the answer as fresh as the rows it describes. Found by
    // an adversarial round.
    staleTime: 0,
  });

  // ⚠️ **AN UNREAD WHITELIST IS NOT AN UNTICKED ROLE, AND SAYING SO WOULD
  // CONTRADICT THE SENTENCE ON THE SAME SCREEN.** When the offered list failed
  // or has not arrived, `offered` is empty for a reason that has nothing to do
  // with ticks — and unioning against an empty list marks EVERY carried role
  // „nu mai este disponibil" while `roleListUnavailable` prints underneath
  // saying the list could not be read. Both cannot be true. Found by an
  // adversarial round; it also removes the flash where the carried read lands
  // first and un-marks itself a moment later, and it keeps #34.04's gate
  // meaning what its comment says on the screens that render the select
  // conditionally.
  //
  // ⚠️ **It gates the UNION and not the query.** `enabled: offeredIsKnown`
  // would serialise the two reads — the carried GET could not start until the
  // whitelist GET had returned — and on the screens whose select is gated on
  // the merged length that is a second round trip with no select on screen.
  // They run in parallel and the result is discarded if the whitelist never
  // arrives, which costs one GET and no waiting.
  if (!offeredIsKnown) return offered.map((o) => ({ ...o, unavailable: false }));

  return withCarriedRoles(offered, data ?? [], (role) => t("roleNoLongerOffered", { role }));
}
