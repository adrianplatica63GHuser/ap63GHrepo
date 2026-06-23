"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ListKey } from "@/lib/admin/value-lists/config";
import { ValueListModal } from "./value-list-modal";
import { DocumentPersonsModal } from "./document-persons-modal";
import { PropertyPersonsModal } from "./property-persons-modal";

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
  const [openList, setOpenList] = useState<ListKey | null>(null);
  const [showDocPersons, setShowDocPersons] = useState(false);
  const [showPropertyPersons, setShowPropertyPersons] = useState(false);

  function open(key: ListKey) {
    setOpenList(key);
  }

  function close() {
    setOpenList(null);
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* ── Proprietate ── */}
        <Section label={t("sections.property")}>
          <ListBtn label={t("lists.propertyTypes")}    onClick={() => open("property-types")} />
          <ListBtn label={t("lists.propertyPersons")}  onClick={() => setShowPropertyPersons(true)} />
          <ListBtn label={t("lists.tarla")}             onClick={() => open("tarla")} />
          <ListBtn label={t("lists.useCategories")}     onClick={() => open("use-categories")} />
        </Section>

        {/* ── Persoană ── */}
        <Section label={t("sections.person")}>
          <ListBtn label={t("lists.personTypes")}  onClick={() => open("person-types")} />
          <ListBtn label={t("lists.judicialPersonTypes")} onClick={() => open("judicial-person-types")} />
          <ListBtn label={t("lists.personRoles")}  onClick={() => open("person-roles")} />
          <ListBtn label={t("lists.citizenships")} onClick={() => open("citizenships")} />
        </Section>

        {/* ── Document ── */}
        <Section label={t("sections.document")}>
          <ListBtn label={t("lists.documentTypes")}   onClick={() => open("document-types")} />
          <ListBtn label={t("lists.documentPersons")} onClick={() => setShowDocPersons(true)} />
          <ListBtn label={t("lists.institutions")}    onClick={() => open("institutions")} />
        </Section>

        {/* ── Others ── */}
        <Section label={t("sections.others")}>
          <ListBtn label={t("lists.services")}  onClick={() => open("services")} />
          <ListBtn label={t("lists.interests")} onClick={() => open("interests")} />
          <ListBtn label={t("lists.groups")}    onClick={() => open("groups")} />
          <ListBtn label={t("lists.stamps")}    onClick={() => open("stamps")} />
        </Section>
      </div>

      {openList && (
        <ValueListModal listKey={openList} onClose={close} />
      )}
      {showDocPersons && (
        <DocumentPersonsModal onClose={() => setShowDocPersons(false)} />
      )}
      {showPropertyPersons && (
        <PropertyPersonsModal onClose={() => setShowPropertyPersons(false)} />
      )}
    </>
  );
}
