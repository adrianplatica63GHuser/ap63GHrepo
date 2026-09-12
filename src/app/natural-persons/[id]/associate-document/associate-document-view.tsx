"use client";

import { useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { buttonClass } from "@/lib/ui/button-styles";
import { NoRolesForTypeNote } from "@/components/forms/no-roles-for-type-note";
import { RoleStrandedNote } from "@/components/forms/role-stranded-note";
import { associationFailureMessage } from "@/lib/ui/association-failure";
// Slice #34.26 — „which of these documents will not be able to offer this role
// again", kept pure so the rule is driven from a test without a connection.
import {
  documentsStrandingRole,
  type DocumentRoleOffer,
} from "@/lib/admin/value-lists/role-stranding";
// Slice #34.15 — one definition of „the list could not be read", shared with
// the four screens that read their roles through a hook in that file.
import { lookupListState } from "@/hooks/use-lookup-options";

const PAGE_SIZE = 15;

type DocumentSearchItem = { id: string; code: string; typeName: string | null; title: string | null };
type SearchResponse = { items: DocumentSearchItem[]; total: number };
type RoleItem = { id: string; name: string };

type Props = {
  personId:   string;
  personName: string;
  backBase:   string;
  /**
   * May THIS reader open „Roluri pe Document" — Slice #34.16.
   *
   * Passed straight to `NoRolesForTypeNote`; that component and
   * `src/lib/auth/can-configure-roles.ts` carry the argument between them.
   */
  canConfigureRoles: boolean;
};

async function searchDocuments(q: string, page: number): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  params.set("limit",  String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(`/api/documents/search?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { items: data.items as DocumentSearchItem[], total: data.total as number };
}

async function fetchValidRoles(documentId: string): Promise<RoleItem[]> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/valid-person-roles`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as RoleItem[];
}

async function fetchDistinctRoles(): Promise<RoleItem[]> {
  const res = await fetch("/api/admin/doc-type-person-roles/distinct-roles");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as RoleItem[];
}

export function AssociateDocumentView({ personId, personName, backBase, canConfigureRoles }: Props) {
  const t           = useTranslations("shared.associateDocument");
  // The sentence itself lives in `shared`, unchanged since Slice #34.04.
  const tShared     = useTranslations("shared");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [qInput,         setQInput]         = useState("");
  const [page,           setPage]           = useState(0);
  /*
   * ⚠️ **A `Map` RATHER THAN A `Set` SINCE SLICE #34.26, AND PAGINATION IS
   * WHY.** The save-time sentence has to NAME the documents whose own type will
   * not offer the chosen role again, and a tick survives paging: `setPage` does
   * not clear the selection, so a document ticked on page 1 is not in `items`
   * while page 2 is on screen and could not be named from the search results at
   * all. The label is therefore captured from the row at the moment it is
   * ticked. One structure rather than a `Set` beside a label record, because
   * two structures mutated in one handler are two that can disagree.
   */
  const [selected,       setSelected]       = useState<Map<string, string>>(new Map());
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [submitting,     setSubmitting]     = useState(false);
  const [submitError,    setSubmitError]    = useState<string | null>(null);

  // Derived: the single selected document ID, or null when 0 or 2+ are selected.
  const singleSelectedId = selected.size === 1 ? Array.from(selected.keys())[0] : null;

  // Reset the role picker whenever the single-selection changes.
  // Uses "derived state during render" to avoid react-hooks/set-state-in-effect.
  const [prevSingleSelectedId, setPrevSingleSelectedId] = useState<string | null>(null);
  if (prevSingleSelectedId !== singleSelectedId) {
    setPrevSingleSelectedId(singleSelectedId);
    setSelectedRoleId("");
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["document-search", qInput, page],
    queryFn:  () => searchDocuments(qInput, page),
  });

  // When exactly one document is selected, fetch roles specific to its type.
  const singleDocRolesQuery = useQuery({
    queryKey: ["document-valid-roles", singleSelectedId],
    queryFn:  () => fetchValidRoles(singleSelectedId!),
    enabled:  singleSelectedId !== null,
  });

  // Always keep the full curated list ready for the 0-or-many case.
  const allDocRolesQuery = useQuery({
    queryKey: ["doc-distinct-roles"],
    queryFn:  fetchDistinctRoles,
  });

  // Active role list: filtered by document type (single) or full list (multi).
  const roles: RoleItem[] = singleSelectedId !== null
    ? (singleDocRolesQuery.data ?? [])
    : (allDocRolesQuery.data ?? []);

  /*
   * ⚠️ **THE ACTIVE LIST'S STATE, NOT BOTH LISTS'.**            (Slice #34.15)
   *
   * This screen is the only one of the five with TWO role lists, and which of
   * them is on screen depends on how many documents are ticked. Reporting the
   * OR of the two would print „the list could not be read" over a working
   * dropdown the moment the other, unrendered list failed — the same false
   * sentence `use-lookup-options.ts` refuses `isError` for. So the state
   * follows the same `singleSelectedId` branch the `roles` line above does.
   *
   * ⚠️ **A disabled query is „loading", never „failed", and that is what makes
   * the branch safe.** With `enabled: false` React Query reports `isPending`
   * true and `fetchStatus` `"idle"`, which `lookupListState` reads as loading —
   * so even if this were read on the multi-document path it could not
   * manufacture a failure out of a query that was never asked to run.
   */
  const roleListState = singleSelectedId !== null
    ? lookupListState(
        singleDocRolesQuery.isPending,
        singleDocRolesQuery.isLoadingError,
        singleDocRolesQuery.fetchStatus,
      )
    : lookupListState(
        allDocRolesQuery.isPending,
        allDocRolesQuery.isLoadingError,
        allDocRolesQuery.fetchStatus,
      );

  /*
   * ⚠️ **ONE READ PER TICKED DOCUMENT, AND ONLY ONCE A ROLE IS CHOSEN.**
   *                                                             (Slice #34.26)
   *
   * The sentence below answers „does THIS document's own type offer the chosen
   * role", per ticked document — which `roles` above cannot answer, because
   * with 2+ ticked it is deliberately the WIDE list (every role ticked for SOME
   * type) and `role-offers.ts:79-89` refuses to narrow it. So the screen asks
   * the per-document question separately, of the endpoint the single-selection
   * branch already reads.
   *
   * ⚠️ **AND THIS SCREEN'S OWN DOOR DOES NOT ASK IT, WHICH IS THE WHOLE REASON
   * THE SENTENCE HAS TO EXIST.** The POST below goes to
   * `/api/people/[id]/documents` → `associateDocumentsToPerson`, whose offered
   * set is `personRoleIdsAcrossDocumentTypes` — the same wide list the select
   * shows — so nothing refuses this write and nothing will. What
   * `listPersonRolesForDocument` answers is what the DOCUMENT side's door and
   * the document's own picker read, and the gap between the two is exactly the
   * one-way door being warned about. An adversarial round found the first draft
   * of this paragraph claiming the door and the sentence read one function,
   * which would tell a reader the write was already being refused.
   *
   * ⚠️ **THE SAME `queryKey` AS `singleDocRolesQuery`, ON PURPOSE.** Not for
   * the caching — ticking a second document drives `singleSelectedId` to null,
   * which the derived-state block above uses to reset the role, so these reads
   * are disabled again until a role is picked and `staleTime` decides the rest.
   * The reason is that one question must have one key: two keys over
   * `/api/documents/[id]/valid-person-roles` would be two answers that agree
   * today, which is the drift `role-offers.ts` and `carried-roles-merge.ts`
   * each refuse for their own rule.
   *
   * ⚠️ **`enabled` ON THE ROLE, SO THE COMMON PATH COSTS NOTHING.** The role is
   * optional and usually left alone; with none chosen nothing can be stranded
   * and `documentsStrandingRole` reads no offer at all. The same laziness
   * `assertRoleMayBeAttached`'s thunk has on the write side, for the same
   * reason.
   *
   * ⚠️ **THE FAN-OUT IS UNCAPPED AND UNBATCHED, STATED RATHER THAN LEFT TO BE
   * MEASURED.** One GET per ticked document, all at once, the moment a role is
   * picked — and the selection survives paging, so forty rows ticked across
   * three pages is forty parallel requests. Left as it is because the endpoint
   * is a two-table read, the realistic selection is a handful, and the
   * alternative is a new route taking a list of ids — a shipped contract for a
   * screen whose warning is dormant until the first document type is
   * configured. In the handover with what that route would look like.
   */
  const tickedDocuments = Array.from(selected, ([id, label]) => ({ id, label }));

  const tickedRoleQueries = useQueries({
    queries: tickedDocuments.map((doc) => ({
      queryKey: ["document-valid-roles", doc.id],
      queryFn:  () => fetchValidRoles(doc.id),
      enabled:  selectedRoleId !== "",
    })),
  });

  /*
   * ⚠️ **THE THREE STATES CARRIED THROUGH RATHER THAN COLLAPSED.** „Still
   * loading" and „could not be read" are not „this type offers nothing": one of
   * them would name a document in a sentence about a fact nobody has
   * established, which is the mistake `role-attachment.ts` refuses for its own
   * offered set. `lookupListState` is the one definition of „failed" and this
   * reads it, exactly as the two branches above do.
   */
  const offerByDocument = new Map<string, DocumentRoleOffer>();
  tickedDocuments.forEach((doc, index) => {
    const q = tickedRoleQueries[index];
    const state = lookupListState(q.isPending, q.isLoadingError, q.fetchStatus);
    offerByDocument.set(
      doc.id,
      state === "loaded"
        ? { state: "loaded", roleIds: (q.data ?? []).map((r) => r.id) }
        : state === "failed"
          ? { state: "failed" }
          : { state: "loading" },
    );
  });

  /*
   * ⚠️ **A DOCUMENT WITH NO ENTRY READS AS „loading", NEVER AS „offers
   * nothing".** The map is built from the very array the lookup walks, so a
   * miss is unreachable — but the fallback still has to be the safe one,
   * because an empty offer is what makes `documentsStrandingRole` NAME a
   * document, and a miss that read that way would invent the sentence instead
   * of withholding it.
   */
  /*
   * ⚠️ **THE RESIDUAL, STATED RATHER THAN LEFT TO BE REDISCOVERED: A DELETED
   * DOCUMENT IS NAMED BY THIS SENTENCE, FOR THE WRONG REASON.**
   * `listPersonRolesForDocument` answers `[]` with a 200 for a document that no
   * longer exists — deliberately, and its header argues the case — so a
   * document deleted in another session reads here as „a type that offers
   * nothing" and gets named. The sentence then promises an association that
   * will in fact fail on the foreign key. It is the same residual that header
   * already records for `shared.noRolesForType` on these two screens, extended
   * to a second sentence; naming it here so the extension is on the record.
   * Distinguishing the two would mean a 404 on a route whose job is to answer a
   * list, which is what that header refuses.
   */
  const strandedByThisRole = documentsStrandingRole(
    tickedDocuments,
    selectedRoleId || null,
    (id) => offerByDocument.get(id) ?? { state: "loading" },
  );

  /*
   * ⚠️ **NO „(nu mai este disponibil)" MARK ON THIS SCREEN, AND IT IS A
   * DECISION RATHER THAN AN OVERSIGHT.**                      (Slice #34.05)
   *
   * The other five person-role pickers union `roles` with the roles the
   * screen's own entity already carries, so a role that lost its whitelist tick
   * is printed marked instead of vanishing (`useRoleOptionsWithCarried`). That
   * mark asserts "the archive carries this role and this list no longer offers
   * it", and on THIS screen there is no scope that makes it true. `roles` above
   * is the SELECTED DOCUMENT TYPE's whitelist, and it changes as documents are
   * ticked; the row a role could be carried on is a (person, document) pair
   * that does not exist yet. Scoped to the person, „Vânzător" — held on a sale
   * contract — would be marked unavailable while a cadastral plan is selected,
   * where it is not withdrawn at all, merely not a party to that kind of
   * document. Scoped to the selected document, the picker would print roles
   * belonging to OTHER people, on a screen that shows none of their rows. Both
   * were found by adversarial rounds, in that order.
   *
   * What would make it answerable is a picker on the ROW — an existing
   * `person_document` association whose role can be changed — which does not
   * exist today: associations are create-and-delete only. It is in the
   * handover.
   */
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const toggle = (item: DocumentSearchItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      // Slice #34.26 — the label the sentence prints, captured here because the
      // row may be off-screen by the time it is needed. Title first and the
      // code when a document has none: the same fallback the results table's
      // own checkbox `aria-label` uses, rather than the „Titlu" cell's, which
      // falls back to an em dash and would name nothing.
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item.title ?? item.code);
      return next;
    });
  };

  const handleAssociate = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(personId)}/documents`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          documentIds:  Array.from(selected.keys()),
          personRoleId: selectedRoleId || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Slice #34.15. The route now has a 400 a user can reach — a role list
        // this screen loaded before an administrator unticked the role — and
        // its `error` is English by design. `associationFailureMessage`
        // recognises that one case by `code` and answers it in the user's own
        // language; everything else reads exactly as it did before.
        throw new Error(
          associationFailureMessage(body, res.status, tShared("roleNotOffered")),
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["person-documents", personId] });
      router.push(`${backBase}/${encodeURIComponent(personId)}?tab=document`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const handleCancel = () =>
    router.push(`${backBase}/${encodeURIComponent(personId)}?tab=document`);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-fade dark:text-zinc-400">{personName}</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 font-medium text-ink dark:text-zinc-300">{t("labelSearch")}</span>
          <input
            type="text"
            value={qInput}
            onChange={(e) => { setQInput(e.target.value); setPage(0); setSelected(new Map()); }}
            placeholder={t("searchPlaceholder")}
            className="w-64 rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <div className="rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>
        ) : isError ? (
          <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("resultsEmpty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="w-8 px-3 py-2" aria-label="select" />
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colCode")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colType")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colTitle")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => toggle(item)}
                  className={[
                    "cursor-pointer border-b border-card-rim last:border-0 dark:border-zinc-800",
                    selected.has(item.id) ? "bg-cta-pale dark:bg-cta/10" : "hover:bg-canvas dark:hover:bg-zinc-800/50",
                  ].join(" ")}
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item)}
                      onClick={(e) => e.stopPropagation()} className="accent-cta" aria-label={item.title ?? item.code} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-fade dark:text-zinc-400">{item.code}</td>
                  <td className="px-3 py-2 text-fade dark:text-zinc-400">{item.typeName ?? "—"}</td>
                  <td className="px-3 py-2 text-ink dark:text-zinc-100">{item.title ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PaginationControls
        page={page} total={total} pageSize={PAGE_SIZE}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      {/* Role dropdown — filtered by document type when one doc selected; full list otherwise */}
      {roles.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 font-medium text-ink dark:text-zinc-300">{t("labelRole")}</span>
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="">{t("rolePlaceholder")}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
      )}

      {/* Slice #34.15. The role is optional here too
          (`personRoleId: selectedRoleId || null`), so the sentence promises the
          association can still be made — and it is the SAME key the two
          „Asociază persoană" screens print, re-used rather than re-worded. */}
      {roleListState === "failed" && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {tShared("roleListUnavailable")}
        </p>
      )}

      {/*
        ⚠️ **THIS SCREEN INHERITED THE EMPTY SELECT FROM A DECISION TAKEN ABOUT
        ANOTHER ONE — Slice #34.16, D-16(b).** When exactly one document is
        ticked, `singleDocRolesQuery` reads
        `/api/documents/[id]/valid-person-roles`, the same endpoint the
        document's own „Asociază persoană" screen reads. That endpoint used to
        fall back to „every role ticked for SOME document type" when the
        selected document's type had none of its own; it no longer does. So the
        select this screen has always gated on `roles.length > 0` can now be
        empty where it never was, and saying nothing there is precisely the
        silence the decision exists to remove. The note is the same component
        and the same `shared` sentence the document screen prints, because it is
        the same fact about the same type.

        ⚠️ **ONLY ON THE SINGLE-DOCUMENT BRANCH.** With 0 or 2+ ticked, `roles`
        is `listDistinctDocPersonRoles` — every role ticked for SOME type — and
        an empty answer there means „this archive has no person-role ticks at
        all", not „this type has none". It is a different sentence for a
        different state, it is not what D-16(b) changed, and printing this one
        would name a document type the user has not chosen. `singleSelectedId`
        is the same branch `roles` and `roleListState` above already follow.

        ⚠️ **THE CONDITION IS A PROP, NOT A `&&` AROUND THE ELEMENT.** The note
        owns an `aria-live` region and has to be mounted before its content
        appears, or a screen reader is not reliably told — the rule
        `value-list-modal.tsx` already follows for its own async sentences.

        ⚠️ **AND THE LIST IT READS IS ALREADY THE BARE WHITELIST ANSWER.**
        `carried-roles.ts` and `use-lookup-options.ts` both explain at length
        why these two screens deliberately do NOT union in a carried role: the
        row a role could be carried on is a (person, document) pair that does
        not exist yet, so no scope makes the mark a true sentence. That is what
        makes `roles.length` the right thing to gate on here, where the document
        screen has to reach past `pickerOptions` to find the same answer.
      */}
      <NoRolesForTypeNote
        show={singleSelectedId !== null && roleListState === "loaded" && roles.length === 0}
        canConfigureRoles={canConfigureRoles}
      />

      {/*
        ⚠️ **THE SENTENCE THIS SLICE EXISTS FOR, AND IT IS BESIDE THE CHOICE
        RATHER THAN AFTER THE WRITE.**                           (Slice #34.26)

        With 2+ documents ticked the select above offers every role ticked for
        SOME document type, and `role-offers.ts` carries at length why that
        width is right and why narrowing it per selected document was refused.
        What the width costs is this: a role saved onto a document whose own
        type does not tick it can never be chosen for that document again —
        `listPersonRolesForDocument` answers nothing there — so the offer is a
        one-way door that was walked through in silence. The decision recorded
        in `role-offers.ts` was to keep offering the wide list and to say so
        here, before the write, naming the documents.

        ⚠️ **IT CANNOT FIRE ON THE SINGLE-DOCUMENT BRANCH, AND NOTHING ASKS IT
        NOT TO.** With exactly one ticked, `roles` IS that document's own
        whitelist, so a role chosen from it is in the very list this checks.
        `role-stranding.ts` says why that is left to the rule rather than
        written as a second condition here.

        ⚠️ **THE VERDICT IS PASSED WHOLE, NOT FLATTENED.** It has three
        outcomes, and which silence means what is decided in
        `role-stranding.ts`: nothing stranded and still-loading both print
        nothing, and a ticked document whose own list could not be READ prints a
        sentence of its own — because Save is deliberately never blocked, so
        saying nothing there would strand a role in the silence this slice
        exists to remove. An adversarial round found the first draft flattening
        all three into a `string[]`.

        ⚠️ **THE CONDITION IS A PROP, NOT A `&&` AROUND THE ELEMENT**, for the
        reason the note above it carries: the component owns an `aria-live`
        region and has to be mounted before its content appears, or a screen
        reader is not reliably told.
      */}
      <RoleStrandedNote verdict={strandedByThisRole} />

      {submitError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{submitError}</p>}

      <div className="flex items-center gap-3 border-t border-crease pt-4 dark:border-zinc-800">
        <button type="button" onClick={handleAssociate} disabled={submitting || selected.size === 0}
          className={buttonClass({ variant: "primary", size: "lg" })}>
          {submitting ? t("associating") : t("associate")}
        </button>
        <button type="button" onClick={handleCancel} disabled={submitting}
          className={buttonClass({ variant: "secondary", size: "lg" })}>
          {t("cancel")}
        </button>
        {selected.size === 0 && !isLoading && items.length > 0 && (
          <span className="text-xs text-fade dark:text-zinc-500">{t("noSelection")}</span>
        )}
      </div>
    </div>
  );
}
