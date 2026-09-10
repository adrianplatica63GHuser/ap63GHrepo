"use client";

/**
 * „This document type has no person roles configured" — one sentence, three
 * screens.                                   (Decision D-16(b), Slice #34.16)
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   `listPersonRolesForDocument` used to answer „every role ticked for SOME
 *   document type" when the document's own type had none of its own, so a
 *   picker on an unconfigured type showed a wide list of roles nobody had
 *   ticked for that kind of document — while AI party extraction refused to run
 *   against the very same type. D-16(b) removed the fallback, and an empty
 *   select with nothing said would be worse than the wide list it replaces.
 *   This is the „said".
 *
 * ⚠️ **A COMPONENT RATHER THAN THREE COPIES, AND THE THIRD SCREEN IS WHY.**
 * The obvious home for this was the document's own „Asociază persoană" screen,
 * which is the one the decision was written about. But the two person-side
 * „Asociază document" screens read the SAME document-type role endpoint
 * whenever exactly one document is ticked, so the fallback's removal empties
 * their select too — in exactly the case this sentence exists to stop being
 * silent. Three inline copies of one sentence and one link is the drift
 * `carried-roles-merge.ts` and `role-offers.ts` each refuse for their own rule;
 * one component is the same answer.
 *
 * ⚠️ **DO NOT WRITE THAT ENDPOINT'S PATH ANYWHERE IN THIS FILE.**
 * `carried-role-options.test.ts` §3 builds `PICKER_FILES` by SEARCHING every
 * `.tsx` under `src/` for the three whitelist sources — the whole point being
 * that a picker screen nobody listed still fails the count. This file is not a
 * picker; it is what a picker renders when its list is empty. Naming the route
 * in prose here puts it in that population and breaks the eight-screen
 * assertion, which is how the first draft of this component failed. The three
 * screens name the route themselves, where they really do fetch it.
 *
 * ⚠️ **`shared`, NOT `document.associatePerson`.** The wording is about the
 * document TYPE, not about the screen, so it is true verbatim on a person's
 * screen where the type is that of the one document they ticked. A per-screen
 * key would be three Romanian sentences to keep in step.
 *
 * ⚠️ **THE LINK IS GATED AND THE SENTENCE IS NOT.** `app/admin/layout.tsx`
 * admits superusers only — a signed-in reader of any other role is redirected
 * to the home page, and one whose session has lapsed to `/login` — so a link
 * offered to either would read as the page being broken. The FACT — the type has
 * no roles, and „Roluri pe Document" is where that is fixed — is useful to
 * everyone, and the sentence names the path in words for the reader who cannot
 * follow it.
 * `canConfigureRoles` is decided on the server by each page, never by a second
 * `queryFn` under `["auth-me"]`; `src/lib/auth/can-configure-roles.ts` says why.
 *
 * ⚠️ **IT SAYS THE ASSOCIATION IS STILL POSSIBLE.** The role is optional on all
 * three screens (`personRoleId: selectedRoleId || null`), so a sentence that
 * only reported the missing configuration would read as a block on the whole
 * action — which is what `shared.roleListUnavailable` learned to say in #34.15
 * for the neighbouring case. The two are mutually exclusive by construction:
 * both are gated on `lookupListState`, one on „loaded" and one on „failed".
 *
 * ⚠️ **NOT GATED ON THE MERGED PICKER LIST, AND CALLERS MUST NOT DO THAT
 * EITHER.** Since #34.05 a picker also shows the roles the entity's own rows
 * already CARRY, marked „(nu mai este disponibil)" and `disabled`. On an
 * unconfigured type that carries a withdrawn role the select is non-empty and
 * every option in it is unusable — the one place a user most needs telling why
 * nothing can be chosen. Every caller therefore gates on the WHITELIST answer.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * ⚠️ **A NEW TAB, and #34.10's own comment is why.** `ValueListHub` latches
 * `openOnArrival` in `useState` on mount, and its header declares the stale
 * latch unreachable because „every in-app link into this route either carries
 * no params or opens in a new tab". This is the third such link and it carries
 * `?list=`, so it opens in a new tab and that header now names it. It also
 * keeps the half-made association on screen, which is the argument
 * `import-types-blocked-stage.tsx` makes for the second one.
 *
 * ⚠️ **IT CANNOT CARRY THE ROW, AND THAT IS A LIMIT RATHER THAN AN OVERSIGHT.**
 * `import-types-blocked-stage.tsx` puts `?type=<id>` in its link because the
 * screen it opens takes one. This route takes `?list=` and `?add=<name>` only —
 * `add` seeds a NEW type's name, which is the wrong verb here — and the roles
 * grid is a toolbar button over the list rather than a deep link. So this lands
 * on the document-types list and the sentence beside it names the button. A
 * `?docPersons=` parameter would remove that last step; it is in the handover
 * rather than in this slice, because it reaches `page.tsx`, `ValueListHub` and
 * `ValueListModal` and re-opens the latch paragraph above.
 */
const DOCUMENT_TYPES_HREF = "/admin/value-lists?list=document-types";

export function NoRolesForTypeNote({
  show,
  canConfigureRoles,
}: {
  show: boolean;
  canConfigureRoles: boolean;
}) {
  const t = useTranslations("shared");

  /*
   * ⚠️ **ALWAYS MOUNTED, WITH THE CONDITION PASSED IN — AND THE LIVE REGION IS
   * THE ONLY REASON.** The obvious shape is `{cond && <NoRolesForTypeNote/>}`,
   * and it was the first one; an adversarial round killed it. This sentence
   * arrives asynchronously on every screen that shows it — when the roles GET
   * resolves on the document screen, on a checkbox click on the two
   * person-side ones — and the sentence it is deliberately paired against,
   * `shared.roleListUnavailable`, is a `role="alert"` on all three. So a
   * screen-reader user was told when the list could not be READ and told
   * nothing when the type has no roles: the exact silence D-16(b) exists to
   * remove, for the one reader who cannot see the paragraph appear.
   *
   * `value-list-modal.tsx` already holds this archive's answer — it mounts its
   * `aria-live` wrapper unconditionally, because a live region that appears
   * together with its content is not reliably announced. Keeping the region
   * here and the condition in `show` is that rule with the wrapper owned by
   * the one component instead of copied into three screens.
   *
   * ⚠️ **`status`, NOT `alert`.** Nothing has gone wrong: the type is
   * unconfigured and the association can still be made without a role.
   * `alert` is assertive and interrupts; this is the polite half of the pair.
   *
   * ⚠️ **`sr-only` WHEN EMPTY, AND AN ADVERSARIAL ROUND MEASURED WHY IT CANNOT
   * SIMPLY BE AN EMPTY `<div>`.** All three screens lay their sections out in a
   * `flex flex-col gap-6`, and a zero-height flex item is still a flex item: an
   * always-mounted empty wrapper adds a 24px row gap above the buttons on every
   * visit — including the ordinary one, where the type IS configured and this
   * says nothing. `value-list-modal.tsx` gets away with a bare
   * `<div aria-live="polite">` because it sits in normal block flow, not in a
   * `gap` container; that is the half of the precedent that does not transplant.
   * `sr-only` is `position: absolute`, so the element leaves flex flow and
   * contributes no gap while staying in the accessibility tree.
   *
   * ⚠️ **NOT `hidden`, and not an `:empty` rule.** Both are `display: none`,
   * which takes the region out of the accessibility tree and puts back exactly
   * the „the live region appears together with its content" problem this
   * structure exists to avoid.
   */
  return (
    <div
      role="status"
      aria-live="polite"
      className={show ? "text-sm text-fade dark:text-zinc-400" : "sr-only"}
    >
      {!show ? null : (
        <>
          <p>{t("noRolesForType")}</p>
          {canConfigureRoles && (
            <p className="mt-1.5">
              <Link
                href={DOCUMENT_TYPES_HREF}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-cta underline underline-offset-2 dark:text-amber-200"
              >
                {/* ⚠️ **THE „NEW TAB" NOTE IS PART OF THE LABEL, NOT A SECOND KEY.**
                    `import-types-blocked-stage.tsx` splits it — one visible
                    sentence for the whole screen plus a per-link `sr-only` span —
                    because it renders a link per blocked type and twenty visible
                    notes would be noise. There is exactly one link here, so the
                    split buys nothing and costs a fourth message string saying
                    what `adminImport.typesBlocked.opensInNewTab` already says.
                    Inside the label it is announced by a screen reader and read
                    by a sighted user from the same words, which is the whole of
                    what that split was for. */}
                {t("noRolesForTypeLink")}
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
