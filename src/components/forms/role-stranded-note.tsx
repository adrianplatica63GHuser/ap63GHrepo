"use client";

/**
 * „This role will not be choosable for these documents again" — one sentence,
 * two screens.                                                 (Slice #34.26)
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   „Asociază document" offers the wide list — every role ticked for SOME
 *   document type — whenever 0 or 2+ documents are ticked, and that width is
 *   deliberate (`role-offers.ts`). So a save that mixes a configured type with
 *   an unconfigured one writes a role onto a document whose own type will never
 *   offer it again, and the screen said nothing at the moment of writing. This
 *   is the „said".
 *
 * ⚠️ **A COMPONENT RATHER THAN TWO COPIES**, for the reason
 * `no-roles-for-type-note.tsx` beside it gives for three: the two person-side
 * „Asociază document" screens are near-copies of one another, and two inline
 * copies of one Romanian sentence is the drift `carried-roles-merge.ts` and
 * `role-offers.ts` each refuse for their own rule.
 *
 * ⚠️ **DO NOT NAME A WHITELIST ENDPOINT OR THE ROLE-OPTIONS HOOK ANYWHERE IN
 * THIS FILE — NOT IN CODE AND NOT IN PROSE.**
 * `carried-role-options.test.ts` §3 builds `PICKER_FILES` by SEARCHING every
 * `.tsx` under `src/` for those spellings, WITHOUT stripping comments, so that
 * a picker screen nobody listed still fails the eight-screen count. This file
 * is not a picker; it is what a picker renders beside itself. Writing one of
 * them here — even in a paragraph explaining that it must not be written here —
 * puts this file in that population and breaks a count two suites away.
 * `no-roles-for-type-note.tsx` records falling into that trap first, and the
 * first draft of THIS file fell into it again by quoting the three strings
 * inside this very warning; `role-stranding.test.ts` §2 now asserts the
 * absence, so the failure reads as being about this file rather than about
 * pickers. The two screens name the route themselves, where they really do
 * fetch it.
 *
 * ⚠️ **`shared`, NOT a per-screen key.** The sentence is about the documents
 * and their type, not about which of the two screens is open, so it is true
 * verbatim on both. A per-screen key would be two Romanian sentences to keep in
 * step.
 *
 * ⚠️ **BOTH ITS SENTENCES SAY THE ASSOCIATION STILL HAPPENS.** This is a
 * warning beside a choice, not a refusal — the decision `role-offers.ts`
 * records. A sentence that only reported the consequence would read as a block
 * on the whole action, which is what `shared.roleListUnavailable` learned not
 * to do in #34.15 and `shared.noRolesForType` in #34.16. All four of them say
 * in their own words that the association can still be made, and that is on
 * purpose.
 *
 * ⚠️ **IT NAMES THE DOCUMENTS — BOTH SENTENCES DO.** „Some of the selected
 * documents" would leave the user to work out which, on a screen where the
 * ticked rows may be spread over several pages of search results. The labels
 * come from the row the user ticked, held in the selection itself for exactly
 * that reason. The „could not be read" branch below was drafted without them,
 * and an adversarial round found this paragraph being broken one screen-full
 * after it was written: naming those documents is also the only thing that
 * makes that state actionable, since re-ticking them is the user's only move.
 *
 * ⚠️ **ICU `plural`, BECAUSE THE CANONICAL CASE NAMES EXACTLY ONE DOCUMENT.**
 * The repro `role-offers.ts` records — one configured type, one unconfigured —
 * strands a single document, so a hard-plural „acestor acte" would be wrong on
 * the commonest path rather than on an edge. `count` is passed beside
 * `documents` for that reason and for no other.
 *
 * ⚠️ **„COULD NOT CHECK" IS ITS OWN SENTENCE, AND IT IS NOT SILENCE.** The
 * verdict has three outcomes, not two: nothing is stranded, these are, and „one
 * of the ticked documents could not be read, so this cannot be answered". The
 * first draft rendered the third as nothing at all — and since the Save button
 * is deliberately never blocked, that is a role stranded in exactly the silence
 * this component exists to remove, reachable by one failed GET or a browser
 * that went offline (`lookupListState` counts a paused query as failed). An
 * adversarial round found it. The sentence says the association can still be
 * made, because it can.
 *
 * ⚠️ **STILL LOADING IS NOT THAT, AND PRINTS NOTHING.** The same draft, fixed
 * naively, would have flashed „could not be checked" on every ordinary visit
 * between picking a role and the reads landing. `role-stranding.ts` returns
 * which of the two it is for exactly this reason; only „failed" speaks.
 *
 * ⚠️ **AND IT SAYS THE ROLE WILL BE WRITTEN, NOT THAT THE ROLE IS OPTIONAL.**
 * That clause is borrowed from `shared.roleListUnavailable`, where it is true
 * because the select is empty and no role CAN be chosen. Here the sentence is
 * unreachable unless a role has been chosen, and the save will write it — so
 * „rolul este oricum opțional" would read as „nothing is at stake" at the one
 * moment something is. An adversarial round found the first draft borrowing it.
 *
 * ⚠️ **NEITHER BRANCH CAN PRINT ON TODAY'S DATA, AND THAT IS NOT A REASON TO
 * SOFTEN EITHER.** `lookup_doc_type_person_role` is empty
 * (`role-whitelists.ts:66-80`), so both branches of these screens' role select
 * are empty and no role can be chosen at all; `role-offers.ts` carries the
 * correction to the slice description that claimed otherwise. This component is
 * dormant until the first document type is configured.
 */

import { useTranslations } from "next-intl";
import type { StrandingVerdict } from "@/lib/admin/value-lists/role-stranding";

/**
 * ⚠️ **THE VERDICT WHOLE, NOT A BOOLEAN AND A LIST.** Three outcomes have to
 * reach this component — nothing is stranded, these are, and one of the ticked
 * documents could not be read — and a caller that flattened them would have to
 * decide here which silence means what. Taking the union keeps that decision in
 * `role-stranding.ts`, where the rule is, and makes „loading" impossible to
 * confuse with „failed" at the one place it prints.
 */
export function RoleStrandedNote({ verdict }: { verdict: StrandingVerdict }) {
  const t = useTranslations("shared");
  const stranded = verdict.known ? verdict.documents : [];
  // ⚠️ The two can never both be non-empty: `documentsStrandingRole` reports a
  // failed read INSTEAD of a partial list, because naming three documents out
  // of four would be a wrong sentence rather than a partial one.
  const unreadable = !verdict.known && verdict.because === "failed" ? verdict.unreadable : [];
  const show = unreadable.length > 0 || stranded.length > 0;

  /*
   * ⚠️ **ALWAYS MOUNTED, WITH THE CONDITION IN THE PROP — the rule
   * `no-roles-for-type-note.tsx` carries at length, and the same reasoning
   * applies here harder.** This sentence arrives asynchronously TWICE over: on
   * a checkbox click, and again when the role `<select>` changes. A live region
   * that appears together with its content is not reliably announced, so a
   * screen-reader user would be told about the failed read
   * (`shared.roleListUnavailable`, `role="alert"`) and the unconfigured type
   * (`shared.noRolesForType`, `role="status"`) and told nothing about the one
   * consequence that outlives the visit.
   *
   * ⚠️ **`status`, NOT `alert` — FOR BOTH BRANCHES, AND THE SECOND ONE NEEDS
   * THE ARGUMENT MADE RATHER THAN INHERITED.** Nothing is refused either way:
   * the save happens exactly as asked, which is what `alert` — assertive, and
   * it interrupts — would misrepresent. The awkward one is the „could not be
   * read" branch, because the archive's other „a list could not be read"
   * sentence, `shared.roleListUnavailable`, IS an `alert` on all eight screens.
   * The difference is what the user is being stopped from doing: there the
   * select is empty and the choice is gone, which is a state they must be
   * interrupted about; here the choice is theirs and intact and this is a
   * caveat beside it. Interrupting someone mid-`<select>` to tell them a
   * background check did not complete is how a live region gets ignored.
   * An adversarial round is what asked for this to be argued rather than
   * assumed from the first branch.
   *
   * ⚠️ **`sr-only` WHEN EMPTY, NOT `hidden` AND NOT AN EMPTY `<div>`.** Both
   * screens lay their sections out in a `flex flex-col gap-6`, where a
   * zero-height flex item still contributes a 24px row gap on every ordinary
   * visit; and `hidden` is `display: none`, which takes the region out of the
   * accessibility tree and puts back the problem this structure exists to
   * avoid. `sr-only` is `position: absolute`, so the element leaves flex flow
   * and stays announced. Measured in #34.16 on these same two screens.
   */
  return (
    <div
      role="status"
      aria-live="polite"
      className={show ? "text-sm text-fade dark:text-zinc-400" : "sr-only"}
    >
      {!show ? null : unreadable.length > 0 ? (
        <p>
          {t("roleStrandedUnknown", {
            count: unreadable.length,
            documents: unreadable.join(", "),
          })}
        </p>
      ) : (
        <p>
          {t("roleStranded", {
            count: stranded.length,
            documents: stranded.join(", "),
          })}
        </p>
      )}
    </div>
  );
}
