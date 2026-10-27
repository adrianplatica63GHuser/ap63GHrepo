"use client";

/**
 * An identity type's form under „Tipuri de documente": the system form.  (Slice 40.84)
 *
 * Adrian, 2026-10-26: „There is no Form for this document under Administration / Reference data / Document types …
 * There are no fields defined for "Carte de Identitate"". Since 40.82 an identity type's fields are code — the
 * kinds registry (src/lib/identity-documents/kinds.ts) — the same for every document of the kind, and #32.07's rule
 * stands: an identity type never holds a free form. So this screen SHOWS that form, read-only: the fields in the
 * order the card prints them, each with its Romanian label, the kind of value and its width step, under one line
 * saying it is defined by the application. Changing it (a field, a width) is a slice, not this screen.
 *
 * Colours are role tokens (colour-tokens.test.ts).
 */
import { useTranslations } from "next-intl";
import { IDENTITY_KINDS, type IdentityKind } from "@/lib/identity-documents/kinds";
import { COLUMN_NAMES_FACE } from "@/lib/ui/title-type";

export function IdentitySystemForm({ kind, typeName }: { kind: IdentityKind; typeName: string }) {
  const t = useTranslations("identityDocument");
  const fields = IDENTITY_KINDS[kind].fields;
  return (
    <div className="flex flex-col gap-3" data-identity-system-form={kind}>
      <p className="text-sm text-ink" data-system-form-line="">
        {t("systemForm.line")}
      </p>
      <table className="w-full text-sm" aria-label={t("systemForm.caption", { type: typeName })}>
        <thead>
          <tr className={`border-b border-card-rim text-left ${COLUMN_NAMES_FACE}`}>
            <th className="px-2 py-1.5">{t("systemForm.colField")}</th>
            <th className="px-2 py-1.5">{t("systemForm.colValue")}</th>
            <th className="px-2 py-1.5">{t("systemForm.colWidth")}</th>
            <th className="px-2 py-1.5">{t("systemForm.colStored")}</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.key} className="border-b border-card-rim last:border-0" data-system-field={f.key}>
              <td className="px-2 py-1.5 text-ink">{t(f.messageKey.slice("identityDocument.".length))}</td>
              <td className="px-2 py-1.5 text-ink">{t(`systemForm.values.${f.type}`)}</td>
              <td className="px-2 py-1.5 font-mono text-ink" data-system-width={f.width.step}>
                {f.width.step}
                {f.width.kind === "lines" ? ` · ${t("systemForm.lines", { n: f.width.rows ?? 1 })}` : ""}
              </td>
              <td className="px-2 py-1.5 text-fade">{t(`systemForm.stored.${f.target}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
