/**
 * „Which of these documents will not be able to offer this role again?"
 *                                                              (Slice #34.26)
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   „Asociază document" offers every role ticked for SOME document type
 *   whenever 0 or 2+ documents are ticked (`role-offers.ts`
 *   `personRoleIdsAcrossDocumentTypes`, and that width is deliberate). Tick a
 *   configured type and an unconfigured one together, pick a role, save: two
 *   `person_document` rows are written, and on the unconfigured one
 *   `listPersonRolesForDocument` answers nothing, so that role can never be
 *   chosen for that document again. Nothing was said at the moment of writing.
 *
 * ⚠️ **A SENTENCE, NOT A REFUSAL, AND THE DECISION IS RECORDED IN
 * `role-offers.ts`.** The two costs were named there and this slice took the
 * second: a refusal would take away an attachment that is legitimate, visible
 * and correctly displayed — #34.05's union still renders the row, marked
 * „(nu mai este disponibil)" — so the answer is to change the promise the
 * screen makes, not to hide the option. The role stays optional and the save
 * still happens.
 *
 * ⚠️ **PURE, FOR THE SAME REASON `role-attachment.ts` IS.** „Which documents
 * strand this role" is answerable in a test without a browser, a server or a
 * connection; the screen hands in what its own queries already hold. This
 * module imports nothing.
 *
 * ⚠️ **IT NARROWS NOTHING.** `role-offers.ts:79-89` refuses to narrow
 * `personRoleIdsAcrossDocumentTypes` per selected document — it would be
 * stricter than the screen and unanswerable for the ordinary multi-document
 * write. This is not that: the offer is unchanged, the door is unchanged, and
 * what this adds is a sentence beside a choice the user is still free to make.
 *
 * ⚠️ **THE TEST IS „DOES THIS DOCUMENT'S OWN TYPE OFFER THIS ROLE", NOT „HAS
 * ITS TYPE ANY TICKS AT ALL".** The repro is the empty case. But a type that
 * HAS ticks and simply does not have THIS one is the same one-way door —
 * „Vânzător" saved onto a donation contract that ticks only „Donator" is
 * exactly as unofferable afterwards — and it is the same query either way. The
 * narrower test would have left that half silent.
 *
 * ⚠️ **AND THE WARNING IS DORMANT ON TODAY'S DATA, WHICH IS A FACT ABOUT WHEN
 * IT STARTS MATTERING RATHER THAN AN ARGUMENT AGAINST IT.**
 * `role-whitelists.ts:66-80` measured `lookup_doc_type_person_role` empty — 48
 * document types, 48 with no ticks. With that table empty
 * `listDistinctDocPersonRoles` returns nothing, so with 2+ documents ticked
 * „Asociază document" renders no `<select>` at all, no role can be chosen, and
 * this rule short-circuits on the null role. The slice description read that
 * measurement the other way round — „what every multi-document save looks like
 * today" — and an adversarial round showed it cannot be: the repro needs ONE
 * configured type for the wide list to contain the role at all. So this exists
 * for the state that begins the day the first document type is configured,
 * which is the state the archive is being set up to reach.
 *
 * ⚠️ **AN UNREADABLE LIST IS NOT AN EMPTY ONE, AND THE VERDICT SAYS SO RATHER
 * THAN GUESSING.** `role-attachment.ts` makes the same point about its own
 * `offeredRoleIds`: a caller that turned „the database is down" into „that role
 * is not valid here" would be manufacturing a fact. So a document whose offer
 * is still loading, or failed, makes the WHOLE answer `known: false` — one
 * unread document and the STRANDING sentence says nothing, because a sentence
 * that named three of four documents would be a wrong sentence rather than a
 * partial one. What the failed case gets instead is the paragraph below; only
 * „still loading" is answered with silence.
 *
 * ⚠️ **AND IT SAYS WHICH OF THE TWO, BECAUSE THE SCREEN OWES THE USER A
 * DIFFERENT THING FOR EACH.** „Still loading" is a moment and deserves silence;
 * „could not be read" is a state a user can sit in with the Save button
 * deliberately never blocked, which is a role stranded in exactly the silence
 * this slice exists to remove. An adversarial round found the first draft
 * collapsing both into „print nothing". Like everything else here it is dormant
 * until the first document type is configured — see the measurement above.
 *
 * ⚠️ **THIS SCANS THE WHOLE LIST RATHER THAN RETURNING AT THE FIRST UNREAD
 * DOCUMENT, AND THERE ARE TWO REASONS — THE SECOND IS THE ONE A REFACTOR
 * BREAKS.** First, „failed" outranks „loading": tick three, let the first still
 * be in flight and the second fail, and returning on the first would report a
 * moment for a state that is never going to resolve, so the sentence would
 * never be shown. Second, and less obvious, the failed arm has to carry EVERY
 * unreadable label — naming one of five is the „some of the selected
 * documents" this design rejects. An early return satisfies the first reason
 * completely while breaking the second in silence, which is why both are
 * written here and why the test has a case with TWO failed documents. The cost
 * is walking a list that is a handful of entries long.
 */

/** One ticked row, as the screen holds it. `label` is what the sentence prints. */
export type TickedDocument = {
  id: string;
  label: string;
};

/**
 * What one document's own whitelist answered — the three states
 * `lookupListState` already distinguishes, carried through rather than
 * collapsed into „no roles".
 */
export type DocumentRoleOffer =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "loaded"; roleIds: readonly string[] };

/**
 * `known: false` is „not answerable", never „nothing is stranded" — which is
 * `known: true` with an empty `documents`. `because` separates the two reasons
 * a caller owes the user different things for: „loading" is a moment and gets
 * silence, „failed" is a state and gets a sentence.
 *
 * ⚠️ **THE FAILED ARM IS NEVER CONSTRUCTED WITH AN EMPTY `unreadable`**, and
 * the note's own „should I show anything" gate depends on that: it asks
 * `unreadable.length > 0`, so a verdict built by hand with an empty array would
 * render nothing — the exact silence this arm exists to break. The guard is the
 * `unreadable.length > 0` test at the return below, and it is the only place
 * that invariant lives; a tuple type would carry it instead, at the cost of a
 * narrowing at the return site.
 *
 * ⚠️ **AND THE FAILED ARM CARRIES THE LABELS, FOR THE REASON THE SENTENCE
 * EXISTS AT ALL.** `role-stranded-note.tsx` argues that „some of the selected
 * documents" would leave the user to work out which, on a screen whose ticked
 * rows may be spread over several pages of search results — and the first
 * draft of this arm then said exactly that, because it carried no labels. An
 * adversarial round found the principle being broken one step after it was
 * stated. Naming the documents whose list could not be read is also the only
 * thing that makes the state actionable: it is what the user would have to
 * re-tick.
 */
export type StrandingVerdict =
  | { known: false; because: "loading" }
  | { known: false; because: "failed"; unreadable: string[] }
  | { known: true; documents: string[] };

/**
 * The rule, and the only place it is written.
 *
 * ⚠️ **A NULL ROLE READS NOTHING AND IS NEVER A QUESTION** — the same shape
 * `mayAttachRole` uses, and for the same reason: the role is optional on this
 * screen, and with none chosen there is nothing to strand. That is also why the
 * common path costs no query: the caller can leave its per-document reads
 * disabled until a role is picked.
 *
 * ⚠️ **NO SPECIAL CASE FOR ONE TICKED DOCUMENT, DELIBERATELY.** With exactly
 * one ticked, the screen already offers that document's own narrow list, so the
 * general rule answers `[]` by construction and a hand-written „size < 2"
 * shortcut would only be a second statement of that fact — one that would go on
 * being true after the screen stopped narrowing.
 *
 * `offerFor` is a lookup rather than a map so the caller can keep its results
 * in whatever order `useQueries` hands them back; order here follows `ticked`,
 * which is the order the user ticked them.
 */
export function documentsStrandingRole(
  ticked: readonly TickedDocument[],
  roleId: string | null,
  offerFor: (documentId: string) => DocumentRoleOffer,
): StrandingVerdict {
  if (roleId === null || roleId === "") return { known: true, documents: [] };

  const documents: string[] = [];
  const unreadable: string[] = [];
  let loading = false;

  for (const doc of ticked) {
    const offer = offerFor(doc.id);
    if (offer.state === "failed") { unreadable.push(doc.label); continue; }
    if (offer.state === "loading") { loading = true; continue; }
    if (!offer.roleIds.includes(roleId)) documents.push(doc.label);
  }

  if (unreadable.length > 0) return { known: false, because: "failed", unreadable };
  if (loading) return { known: false, because: "loading" };
  return { known: true, documents };
}
