"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ListKey } from "@/lib/admin/value-lists/config";
import { ValueListModal } from "./value-list-modal";

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
          <ListBtn label={t("lists.propertyTypes")}  onClick={() => open("property-types")} />
          <ListBtn label={t("lists.tarla")}           onClick={() => open("tarla")} />
          <ListBtn label={t("lists.useCategories")}   onClick={() => open("use-categories")} />
        </Section>

        {/* ── Persoană ── */}
        <Section label={t("sections.person")}>
          <ListBtn label={t("lists.personTypes")}  onClick={() => open("person-types")} />
          <ListBtn label={t("lists.citizenships")} onClick={() => open("citizenships")} />
        </Section>

        {/* ── Document ── */}
        <Section label={t("sections.document")}>
          <ListBtn label={t("lists.documentTypes")} onClick={() => open("document-types")} />
          <ListBtn label={t("lists.institutions")}  onClick={() => open("institutions")} />
        </Section>

        {/* ── Servicii & Interese (standalone) ── */}
        <div className="flex">
          <ListBtn
            label={t("lists.serviceInterests")}
            onClick={() => open("service-interests")}
          />
        </div>
      </div>

      {openList && (
        <ValueListModal listKey={openList} onClose={close} />
      )}
    </>
  );
}
