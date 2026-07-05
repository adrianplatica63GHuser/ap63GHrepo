"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ListKey } from "@/lib/admin/value-lists/config";
import { ValueListModal } from "./value-list-modal";
import { DocumentPersonsModal } from "./document-persons-modal";
import { PropertyPersonsModal } from "./property-persons-modal";
import { PropertyPropertyModal } from "./property-property-modal";
import { DocumentDocumentModal } from "./document-document-modal";
import { PersonPersonModal } from "./person-person-modal";

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-card-rim bg-card dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-card-rim px-4 py-2 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink dark:text-zinc-400">
          {label}
        </span>
      </div>
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

// ── Document to Property informational modal ──────────────────────────────────

function DocToPropertyModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("valueList.docToPropertyInfo");
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-1/3 z-50 mx-auto max-w-md rounded-xl border border-card-rim bg-card p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="mb-3 text-base font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>
        <p className="mb-4 text-sm leading-relaxed text-ink dark:text-zinc-300">{t("body")}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white hover:bg-cta-d"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Hub ───────────────────────────────────────────────────────────────────────

export function ValueListHub() {
  const t = useTranslations("valueList");

  const [openList,              setOpenList]              = useState<ListKey | null>(null);
  const [showDocPersons,        setShowDocPersons]        = useState(false);
  const [showPropertyPersons,   setShowPropertyPersons]   = useState(false);
  const [showPropertyProperty,  setShowPropertyProperty]  = useState(false);
  const [showDocumentDocument,  setShowDocumentDocument]  = useState(false);
  const [showPersonPerson,      setShowPersonPerson]      = useState(false);
  const [showDocToProperty,     setShowDocToProperty]     = useState(false);

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

        {/* ── Roles ── */}
        <Section label={t("sections.roles")}>
          {/* Master list */}
          <ListBtn label={t("lists.personRoles")} onClick={() => open("person-roles")} />

          {/* Person-involved sub-row */}
          <SubLabel label={t("sections.rolesPerson")} />
          <ListBtn label={t("lists.personToProperty")} onClick={() => setShowPropertyPersons(true)} />
          <ListBtn label={t("lists.personToDocument")} onClick={() => setShowDocPersons(true)} />
          <ListBtn label={t("lists.personToPerson")}   onClick={() => setShowPersonPerson(true)} />

          {/* Object-to-object sub-row */}
          <SubLabel label={t("sections.rolesObject")} />
          <ListBtn label={t("lists.propertyToProperty")} onClick={() => setShowPropertyProperty(true)} />
          <ListBtn label={t("lists.documentToDocument")} onClick={() => setShowDocumentDocument(true)} />
          <ListBtn label={t("lists.documentToProperty")} onClick={() => setShowDocToProperty(true)} />
        </Section>

        {/* ── Others ── */}
        <Section label={t("sections.others")}>
          <Link
            href="/admin/groups"
            className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cta-d"
          >
            {t("lists.groups")}
          </Link>
          <Link
            href="/admin/stamps"
            className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cta-d"
          >
            {t("lists.stamps")}
          </Link>
        </Section>
      </div>

      {openList            && <ValueListModal listKey={openList} onClose={close} />}
      {showDocPersons      && <DocumentPersonsModal   onClose={() => setShowDocPersons(false)} />}
      {showPropertyPersons && <PropertyPersonsModal   onClose={() => setShowPropertyPersons(false)} />}
      {showPropertyProperty && <PropertyPropertyModal onClose={() => setShowPropertyProperty(false)} />}
      {showDocumentDocument && <DocumentDocumentModal onClose={() => setShowDocumentDocument(false)} />}
      {showPersonPerson    && <PersonPersonModal      onClose={() => setShowPersonPerson(false)} />}
      {showDocToProperty   && <DocToPropertyModal     onClose={() => setShowDocToProperty(false)} />}
    </>
  );
}
