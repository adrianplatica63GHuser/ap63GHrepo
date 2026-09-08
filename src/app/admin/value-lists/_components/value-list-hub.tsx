"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ListKey } from "@/lib/admin/value-lists/config";
import { ValueListModal } from "./value-list-modal";
import { DocumentPersonsModal } from "./document-persons-modal";

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

function SubLabel({ label }: { label: string }) {
  return (
    <div className="w-full border-t border-card-rim pt-3 dark:border-zinc-800">
      <span className="text-xs font-medium text-fade dark:text-zinc-500">{label}</span>
    </div>
  );
}

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

export function ValueListHub() {
  const t = useTranslations("valueList");

  const [openList,       setOpenList]       = useState<ListKey | null>(null);
  const [showDocPersons, setShowDocPersons] = useState(false);

  function open(key: ListKey) { setOpenList(key); }
  function close()             { setOpenList(null); }

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

        {/* ── Roluri ── */}
        <Section label={t("sections.roles")}>
          {/* Master list */}
          <ListBtn label={t("lists.personRoles")} onClick={() => open("person-roles")} />

          {/* Person-involved sub-row.

              Slice #34.04: „Persoană → Proprietate" and „Persoană → Persoană"
              are gone from here, and their words are two CHECKBOXES on the
              „Roluri Persoană" row above. Each opened a modal over a table
              holding one bit per role — a UNIQUE NOT NULL foreign key back to
              the master list and nothing else — so one question about one role
              cost three windows, and the empty-by-default state of
              „Persoană → Persoană" was invisible until you opened it.
              migration_079 made both a boolean column.

              „Persoană → Document" stays a button, and that is not an
              oversight: `lookup_doc_type_person_role` is unique over the PAIR
              (document_type_id, person_role_id) — „Vânzător" is a valid party
              on a sale contract and not on a cadastral plan — so it is a grid
              and a bit cannot hold it. Slice #34.10 moves it to the
              document-type screen. */}
          <SubLabel label={t("sections.rolesPerson")} />
          <ListBtn label={t("lists.personToDocument")} onClick={() => setShowDocPersons(true)} />
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

      {openList       && <ValueListModal listKey={openList} onClose={close} />}
      {showDocPersons && <DocumentPersonsModal onClose={() => setShowDocPersons(false)} />}
    </>
  );
}
