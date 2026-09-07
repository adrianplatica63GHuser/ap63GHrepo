// src/hooks/use-lookup-options.ts
//
// The two Reference Data lists that feed a plain <select> and nothing else:
// `lookup_citizenship` and `lookup_person_type`.                (Slice #34.04)
//
// WHY THIS FILE EXISTS
//   These two were read through a bare `useEffect` + `fetch`, and the hook was
//   written three times: `useCitizenshipOptions` character-for-character in
//   `natural-person-form.tsx` and `id-card-person-dialog.tsx`, and
//   `usePersonTypeOptions` the same body with one URL changed. All three
//   swallowed the failure (`.catch(() => {})`) and held their rows in component
//   state under no cache key at all.
//
//   ⚠️ **A fetch with no cache key is invisible to the invalidation strategy,
//   INCLUDING the unkeyed sweep that exists precisely to catch everything.**
//   The Reference Data delete and move paths call a bare
//   `qc.invalidateQueries()` — no `queryKey`, so it matches every query in the
//   cache — and the SAVE path calls `invalidateListCaches`, which names bare
//   keys one by one (`value-list-modal.tsx`). Neither can reach a `useState`.
//   So renaming „Română" to „Romana" left both forms offering the old spelling
//   until the page was reloaded, and deleting a citizenship left it selectable.
//   Being on a React Query key is what makes those two mechanisms apply, and
//   the keys are BARE (`["citizenships"]`, `["person-types"]`) to match the
//   nine other bare keys `invalidateListCaches` already names.
//
//   ⚠️ **NOT "the last two lists read that way" — `useInstitutionOptions` in
//   `id-card-person-dialog.tsx` is still exactly that shape**, for
//   `institutions`, which is also a `VALID_LIST_KEYS` member with a bare key
//   and a branch. It is left alone deliberately: it is not a read-only
//   dropdown, it gains a row from a button inside the dialog, and its `reload`
//   and `upsert` are load-bearing (Slice #34.02). An adversarial round caught
//   the first draft of this paragraph claiming these two were the last.
//
// ⚠️ **A FIRST LOAD THAT DOES NOT ARRIVE IS NOW SOMETHING THE USER CAN SEE,
//   AND THAT IS THE POINT RATHER THAN A SIDE EFFECT.** Failed, refused, or
//   paused because the browser is offline — see `toState` for why the last of
//   those had to be folded in rather than left as „loading". The old hooks
//   answered a failed GET with an empty array, so an unreadable list and an
//   empty archive rendered identically: a select holding only „—". On the
//   ID-card dialog that is worse than cosmetic — the citizenship read off the
//   card is already in the form state, so Confirm goes on writing it while the
//   field shows „—". Callers get `listState` and are expected to say so on
//   screen; `useInstitutionOptions` uses the same three words for the same
//   reason, and this is that argument applied to the two lists it left alone.
//
// The rows themselves are the value-lists GET's `items` — `{ id, name }` — and
// every caller wants `{ value, label }` for a <select>, so the mapping happens
// here rather than three times at the call sites.
//
// ⚠️ **One behaviour genuinely got worse, and it is small: these two lists were
//   re-read on every mount and are now served from the 30 s staleTime cache**
//   (`query-provider.tsx`). Every in-app change reaches them — the save path
//   through the two new branches in `invalidateListCaches`, the delete and move
//   paths through the unkeyed sweep — so what this can serve stale is a change
//   made OUTSIDE the app (a direct DB edit, or a second administrator) within
//   the last 30 seconds. That is the trade the whole file exists to make.

import { useQuery } from "@tanstack/react-query";

export type LookupOption = { value: string; label: string };

/** Which of the three states the list is in, for the hint under the select. */
export type LookupListState = "loading" | "loaded" | "failed";

export type LookupOptions = {
  options: LookupOption[];
  listState: LookupListState;
};

/**
 * ⚠️ **`res.redirected` as well as `!res.ok`.** An expired session answers
 * with a redirect to the login page, and that HTML parses to `{}` — which
 * `data.items ?? []` then reads as "the archive holds none". `fetchInstitutions`
 * in `id-card-person-dialog.tsx` checks the same thing for the same reason.
 * Throwing is what puts React Query into an error state, which is what the
 * caller renders.
 */
async function fetchLookupOptions(list: string): Promise<LookupOption[]> {
  const res = await fetch(`/api/admin/value-lists/${list}`);
  if (res.redirected || !res.ok) throw new Error(`Failed to load ${list} (HTTP ${res.status})`);
  const data = (await res.json()) as { items?: { id: string; name: string }[] };
  return (data.items ?? []).map((r) => ({ value: r.id, label: r.name }));
}

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
 * is now silent, and a stale list can outlive the row it names.** Delete a
 * citizenship in Reference Data, let the unkeyed sweep invalidate, and if that
 * refetch fails the select goes on offering the deleted row with nothing said.
 * That is the lesser of the two wrongs — the alternative is a red line under a
 * working dropdown on every flaky refetch — and it is what `isRefetchError`
 * exists to treat differently if it ever earns its own quieter hint. It is not
 * an oversight.
 *
 * ⚠️ **`paused` counts as failed, and offline is why.** React Query's
 * `networkMode` pauses a query it cannot start: `fetchStatus` goes to
 * `"paused"` and `status` stays `"pending"` — so a first load attempted while
 * the browser is offline is `isPending` true, `isLoadingError` false, for as
 * long as the machine stays offline. Read as „loading" that is a silent empty
 * select, which is exactly the pre-slice behaviour this file exists to remove,
 * arrived at from the other side, in the failure a laptop user is most likely
 * to hit. There IS no list and it is not on its way, so it is reported as
 * failed; when the connection returns React Query resumes on its own and the
 * line goes away.
 */
function toState(
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
 * screen inside two round trips and a second. These are an eight-row and a
 * seven-row reference list on a LAN, not a flaky third party. (Counted:
 * `drizzle/0002_value_lists.sql` seeds 8 citizenships and 7 person types, and
 * `src/db/sync-reference-data.sql` seeds the same counts for a rebuilt
 * database — the seeded Romanian exists twice and the two copies must agree,
 * which `romanian-diacritics.test.ts` says at more length. An earlier draft
 * said "eleven-row", which is `VALID_LIST_KEYS.length` — the number of LISTS —
 * borrowed one level up into a claim about ROWS.)
 */
const LOOKUP_QUERY_RETRY = 1;

/**
 * `lookup_citizenship`, for the Citizenship select on the natural-person form
 * and on the ID-card review dialog.
 *
 * ⚠️ **The `useQuery` call and its literal key stay in the exported hook
 * rather than moving into a shared helper that takes the key as an argument.**
 * `value-list-dependents.test.ts` proves every bare key `invalidateListCaches`
 * names is really fetched somewhere, by finding the key literal and walking out
 * to the enclosing call — so a key passed in as a variable would read as a key
 * nothing fetches, and the branch that invalidates it would look dead. Two
 * near-identical six-line hooks are the price of that check staying honest.
 */
export function useCitizenshipOptions(): LookupOptions {
  const { data, isPending, isLoadingError, fetchStatus } = useQuery({
    queryKey: ["citizenships"],
    queryFn:  () => fetchLookupOptions("citizenships"),
    retry:    LOOKUP_QUERY_RETRY,
  });
  return { options: data ?? [], listState: toState(isPending, isLoadingError, fetchStatus) };
}

/** `lookup_person_type` — the „Tip Profesional" select (Slice #18.16.VL). */
export function usePersonTypeOptions(): LookupOptions {
  const { data, isPending, isLoadingError, fetchStatus } = useQuery({
    queryKey: ["person-types"],
    queryFn:  () => fetchLookupOptions("person-types"),
    retry:    LOOKUP_QUERY_RETRY,
  });
  return { options: data ?? [], listState: toState(isPending, isLoadingError, fetchStatus) };
}
