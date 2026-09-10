"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { isValidListKey, type ListKey } from "@/lib/admin/value-lists/config";
import { ValueListModal } from "./value-list-modal";

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  label,
  note,
  children,
}: {
  label: string;
  /**
   * A sentence printed under the heading, before the buttons.
   *
   * Slice #34.05: the one caller is „Relație între obiecte", and the sentence
   * is the entire former content of `DocToPropertyModal` — a modal behind a
   * blue button that said only that there is nothing behind it. Printed here it
   * answers the question before it is asked instead of after.
   */
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-card-rim bg-card dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-card-rim px-4 py-2 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink dark:text-zinc-400">
          {label}
        </span>
      </div>
      {note && (
        <p className="border-b border-card-rim px-4 py-3 text-sm leading-relaxed text-fade dark:border-zinc-800 dark:text-zinc-400">
          {note}
        </p>
      )}
      <div className="flex flex-wrap gap-3 p-4">{children}</div>
    </div>
  );
}

// ── Sub-row divider label ─────────────────────────────────────────────────────
//
// ⚠️ **GONE WITH ITS LAST CALLER, Slice #34.10.** `SubLabel` existed to head
// one sub-row of the „Roluri" section — „Persoană implicată" — under which
// three buttons once sat. #34.04 folded two of them into checkboxes on the
// „Roluri Persoană" row and #34.10 moved the third onto the document-type
// screen, so the divider was heading a sub-row with nothing in it. Left behind,
// it would be an unused component in a file a lint run reads, and the next
// person to want a sub-row would find a helper whose one former caller says
// nothing about how it was meant to be used.

// ── List button ───────────────────────────────────────────────────────────────

function ListBtn({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cta-d"
    >
      {label}
    </button>
  );
}

// ── Hub ───────────────────────────────────────────────────────────────────────

export function ValueListHub({
  /**
   * A list to open on arrival, and a name to start adding — Slice #34.10.
   *
   * ⚠️ **VALIDATED HERE with `isValidListKey`, and not trusted from the URL.**
   * `ListKey` is a union and `?list=` is a string anybody can type; casting it
   * would put an unknown key into `LIST_META[listKey]` inside the modal, where
   * `meta.fields` is read without a guard — a blank screen from a typo. An
   * unrecognised value opens the hub exactly as a visit with no parameter does,
   * which is the right failure for a deep link.
   *
   * ⚠️ **`isValidListKey`, NOT `initialList in LIST_META` — and the first draft
   * of this slice wrote the second.** `in` walks the prototype chain of a plain
   * object literal, so `?list=constructor`, `toString`, `valueOf`, `__proto__`,
   * `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable` and
   * `toLocaleString` — eight strings, verified — all passed the guard.
   * `LIST_META["constructor"]` is then `Object`, `meta.fields` is `undefined`,
   * and the modal throws on `displayFields.length` before it paints: exactly
   * the blank screen the paragraph above claims to prevent, delivered by the
   * check meant to prevent it. Found by an adversarial round.
   *
   * `isValidListKey` was already exported from `config.ts` and already used by
   * four API routes; it tests membership of `VALID_LIST_KEYS`, so it reaches no
   * prototype and there is one definition of what a list key is.
   *
   * ⚠️ **`initialAddName` is passed on and NOT validated**, deliberately: it is
   * a type name a person is about to create, and the only thing that may refuse
   * one is the create door itself. Trimming or rejecting it here would be a
   * second opinion about names, one screen away from the one that decides.
   */
  initialList,
  initialAddName,
}: {
  initialList?: string;
  initialAddName?: string;
} = {}) {
  const t = useTranslations("valueList");

  /**
   * ⚠️ **LATCHED IN STATE, not recomputed from the prop on every render.**
   * `openOnArrival` gates `initialAddName` below, and computed fresh it stayed
   * true for the whole visit: a user who arrived with `?add=Foo`, closed the
   * modal and reopened the SAME list from the hub got the add form seeded with
   * "Foo" all over again — which the `initialAddName` prop's own comment says
   * cannot happen. `useState`'s initialiser runs once, so "on arrival" means
   * what it says. Found by an adversarial round.
   *
   * ⚠️ **The residual, stated rather than left to be rediscovered: this latch
   * is STALE under a soft navigation between two `?list=` URLs on this route**
   * — `openOnArrival` would hold list A while `initialAddName` became B's,
   * which is the same cross-list leak arrived at from the other side. Not
   * reachable in this build: every in-app link into this route either carries
   * no params (`preflight-checklist.tsx`) or opens in a new tab
   * (`import-types-blocked-stage.tsx`, and since Slice #34.16
   * `components/forms/no-roles-for-type-note.tsx`, which carries `?list=` from
   * three association screens), so every arrival is a fresh mount. **This
   * enumeration is the whole of the argument, so a link added to this route
   * that is not in it makes the paragraph false rather than merely incomplete**
   * — #34.16 added the third and an adversarial round is what noticed the list
   * had not grown with it. The day one of those becomes a same-tab `<Link>`,
   * both halves have to be latched together — or read from `useSearchParams` rather than from a prop.
   */
  const [openOnArrival] = useState<ListKey | null>(() =>
    initialList !== undefined && isValidListKey(initialList) ? initialList : null,
  );
  /** Consumed once: the second visit to the same list is an ordinary one. */
  const [addNameUsed, setAddNameUsed] = useState(false);

  const [openList, setOpenList] = useState<ListKey | null>(openOnArrival);

  function open(key: ListKey) { setOpenList(key); }
  function close() {
    setOpenList(null);
    // Slice #34.10 — the URL has had its say. See `openOnArrival`.
    setAddNameUsed(true);
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* ── Proprietate ── */}
        <Section label={t("sections.property")}>
          <ListBtn label={t("lists.propertyTypes")}  onClick={() => open("property-types")} />
          <ListBtn label={t("lists.tarla")}           onClick={() => open("tarla")} />
          <ListBtn label={t("lists.useCategories")}   onClick={() => open("use-categories")} />
        </Section>

        {/* ── Persoană ── */}
        <Section label={t("sections.person")}>
          <ListBtn label={t("lists.personTypes")}         onClick={() => open("person-types")} />
          <ListBtn label={t("lists.judicialPersonTypes")} onClick={() => open("judicial-person-types")} />
          <ListBtn label={t("lists.citizenships")}        onClick={() => open("citizenships")} />
        </Section>

        {/* ── Document ── */}
        <Section label={t("sections.document")}>
          <ListBtn label={t("lists.documentTypes")} onClick={() => open("document-types")} />
          <ListBtn label={t("lists.institutions")}  onClick={() => open("institutions")} />
        </Section>

        {/* ── Roluri ──

            Slice #34.04: „Persoană → Proprietate" and „Persoană → Persoană"
            are gone from here, and their words are two CHECKBOXES on the
            „Roluri Persoană" row below. Each opened a modal over a table
            holding one bit per role — a UNIQUE NOT NULL foreign key back to
            the master list and nothing else — so one question about one role
            cost three windows, and the empty-by-default state of
            „Persoană → Persoană" was invisible until you opened it.
            migration_079 made both a boolean column.

            ⚠️ **Slice #34.10 took the third, „Persoană → Document", to the
            document-type screen — and it did NOT become a checkbox, because it
            cannot.** `lookup_doc_type_person_role` is unique over the PAIR
            (document_type_id, person_role_id) — „Vânzător" is a valid party on
            a sale contract and not on a cadastral plan — so it is a grid, and a
            bit cannot hold it. What was wrong with it here was not its shape
            but its address: „who may appear on this kind of document?" belongs
            beside „what fields does this kind of document have?", which is the
            Form editor, two screens away from this one. It now opens from the
            „Tipuri de document" list's own toolbar, under its real name
            „Roluri pe Document" — which is also the name two sentences in
            `value-list-modal.tsx` already used to send people to it.

            So this section is one button again, and it is the master list. */}
        <Section label={t("sections.roles")}>
          <ListBtn label={t("lists.personRoles")} onClick={() => open("person-roles")} />
        </Section>

        {/* ── Relație între obiecte ──

            Slice #34.05: A SECTION, NOT A SUB-ROW OF „Roluri", AND THE WORD
            „rol" IS THE REASON. „Adiacent" and „Înlocuiește" are relationship
            types between two objects of the SAME kind; they are not roles a
            person plays, which is what „rol" means everywhere else in this
            system. They sat under „Roluri" because a sub-row was added to an
            existing section rather than a section beside it.

            The third button that stood here — „Document → Proprietate" —
            opened `DocToPropertyModal`, whose entire content was three strings
            saying there is nothing to configure. The button and the modal are
            gone and the sentence is the section's `note`: `sections
            .rolesObjectNote`, which IS the modal's former `body`, re-homed
            rather than orphaned.

            Slice #29.13 is why the two survivors take `open(...)`: they are
            ordinary value lists on the generic modal, with the refusal, the
            live count and the offer to move the associations. */}
        <Section label={t("sections.rolesObject")} note={t("sections.rolesObjectNote")}>
          <ListBtn label={t("lists.propertyToProperty")} onClick={() => open("property-property-roles")} />
          <ListBtn label={t("lists.documentToDocument")} onClick={() => open("document-document-roles")} />
        </Section>

      </div>

      {openList && (
        <ValueListModal
          listKey={openList}
          // ⚠️ **Only on the list the URL asked for.** The state persists after
          // the first close, so without this term a user who arrived with
          // `?add=` and then opened a DIFFERENT list would get its add form
          // opened with a document type's name in it.
          initialAddName={
            openList === openOnArrival && !addNameUsed ? initialAddName : undefined
          }
          onClose={close}
        />
      )}
    </>
  );
}
