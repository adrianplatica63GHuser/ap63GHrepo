"use client";

/**
 * „Acte de identitate" on a Natural Person — the identity documents the person holds.        (Slice 40.85)
 *
 * Adrian, 2026-10-26: „there is a bit of an overlap … between the identity tile and the identity document tile". The
 * person's facts (names, CNP, birth, sex, citizenship) are on „Identitate"; what a document printed is the document's
 * own (40.82, 40.83). So this tile, which held a card's values on the person, lists the person's identity documents
 * instead — of any kind — read-only (Ask first 2):
 *   - per document: its kind's short name, „Seria și numărul", „Valabil până la", VALABIL / EXPIRAT / EXPIRĂ ÎN n
 *     ZILE (the person tile's words and colours since 40.79) and its code, which opens it;
 *   - the current one first (`orderPersonIdentityDocuments`), marked „curent";
 *   - none: the tile folds to its one line, „niciun act înregistrat", as every empty tile does (40.64).
 * „Adaugă act de identitate" (Ask first 3) asks the kind and opens „Acte → Adaugă act" with it, the person as the
 * holder and the person's names, CNP, sex, date and place of birth filled in; nothing is saved until the document is.
 *
 * A version of the person written before 40.85 still holds the card's values it had then (Ask first 5): viewing it,
 * they show here, read-only, under their old labels.
 *
 * Colours are role tokens (colour-tokens.test.ts).
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { EmptyTileLine } from "@/components/tiles/empty-tile";
import { TileTitle } from "@/components/tiles/tile-title";
import { IDENTITY_KIND_VALUES, type IdentityKind } from "@/lib/identity-documents/kinds";
import {
  orderPersonIdentityDocuments,
  personIdentityLabel,
  type PersonIdentityDocument,
} from "@/lib/identity-documents/person-list";
import { LEGACY_PERSON_ID_CARD_KEYS, type LegacyPersonIdCardSnapshot } from "@/lib/persons/legacy-id-card";
import { COLUMN_NAMES_FACE } from "@/lib/ui/title-type";

/** yyyy-mm-dd → dd.mm.yyyy, as every date on the person's screen reads. */
function formatDateRo(iso: string): string {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Where „Adaugă act de identitate" goes: the new-document screen, with the kind and the holder. */
export function newIdentityDocumentHref(kind: IdentityKind, personId: string): string {
  return `/documents/new?identityKind=${encodeURIComponent(kind)}&holder=${encodeURIComponent(personId)}`;
}

/** The old labels of a version's card values (naturalPerson.fields.*), in the order the old tile drew them. */
const LEGACY_LABEL: Readonly<Record<(typeof LEGACY_PERSON_ID_CARD_KEYS)[number], string>> = {
  idDocumentType: "idDocumentType",
  idDocumentNumber: "idDocumentNumber",
  idCardNumber: "idCardNumber",
  idValidFrom: "idValidFrom",
  idValidUntil: "idValidUntil",
  idIssuingAuthority: "idIssuingAuthority",
  idMrzRaw: "idMrzRaw",
};

export function PersonIdentityDocuments({
  personId,
  documents,
  soonDays,
  legacy,
  title,
  subtitle,
  canAdd,
}: {
  personId: string;
  documents: readonly PersonIdentityDocument[];
  soonDays: number;
  /** The viewed version's own fields, when it is not the latest; its card values, if it has any, are shown. */
  legacy: LegacyPersonIdCardSnapshot | null;
  title: string;
  subtitle: string;
  /** Not while a version is viewed, and not on a record opened read-only. */
  canAdd: boolean;
}) {
  const t = useTranslations("naturalPerson.identityDocs");
  const tNp = useTranslations("naturalPerson");
  const tKind = useTranslations("identityDocument.kinds");
  const tValidity = useTranslations("identityDocument.validity");
  const router = useRouter();
  const [choosing, setChoosing] = useState(false);
  const [kind, setKind] = useState<IdentityKind>("CI_NOU");
  const rows = orderPersonIdentityDocuments(documents, new Date(), soonDays);
  const legacyRows = legacy
    ? LEGACY_PERSON_ID_CARD_KEYS.flatMap((k) => {
        const v = (legacy[k] ?? "").toString().trim();
        if (!v) return [];
        const shown = k === "idDocumentType" ? (v === "ID_CARD" || v === "PASSPORT" ? tNp(`options.idDoc.${v}`) : v) : k === "idValidFrom" || k === "idValidUntil" ? formatDateRo(v) : v;
        return [[tNp(`fields.${LEGACY_LABEL[k]}` as "fields.idDocumentType"), shown] as const];
      })
    : [];

  const chooser = choosing && (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-wire bg-raised p-3" data-identity-kind-chooser="">
      <p className="text-sm text-ink" id="identity-kind-question">{t("kindQuestion")}</p>
      <div role="radiogroup" aria-labelledby="identity-kind-question" className="flex flex-col gap-1">
        {IDENTITY_KIND_VALUES.map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="identity-kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
            {tKind(k)}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <IconButton icon={Plus} label={t("continue")} variant="primary" size="sm" onClick={() => router.push(newIdentityDocumentHref(kind, personId))} />
        <button type="button" className="rounded-md px-2 py-1 text-sm text-fade hover:text-ink" onClick={() => setChoosing(false)}>
          {t("cancel")}
        </button>
      </div>
    </div>
  );

  const addButton = canAdd ? (
    <IconButton icon={Plus} label={t("add")} variant="secondary" size="sm" onClick={() => setChoosing(true)} />
  ) : undefined;

  if (rows.length === 0 && legacyRows.length === 0) {
    return (
      <div data-identity-documents="" data-identity-documents-count={0}>
        <EmptyTileLine tile="idCard" title={title} state="noIdDocument" onAdd={canAdd ? () => setChoosing(true) : undefined} />
        {chooser}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-identity-documents="" data-identity-documents-count={rows.length}>
      <TileTitle title={title} subtitle={subtitle} action={addButton} />
      {chooser}
      {rows.length === 0 ? (
        <p className="text-sm text-fade">{t("none")}</p>
      ) : (
        <table className="w-full text-sm" aria-label={t("caption")}>
          <thead>
            <tr className={`border-b border-card-rim text-left ${COLUMN_NAMES_FACE}`}>
              <th className="px-1.5 py-1">{t("colKind")}</th>
              <th className="px-1.5 py-1">{t("colNumber")}</th>
              <th className="px-1.5 py-1">{t("colValidUntil")}</th>
              <th className="px-1.5 py-1">{t("colStatus")}</th>
              <th className="px-1.5 py-1">{t("colCode")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-card-rim last:border-0" data-identity-document={r.id} data-identity-current={r.current ? "" : undefined}>
                <td className="px-1.5 py-1 text-ink" title={r.typeName}>
                  {personIdentityLabel(r)}
                  {r.current && <span className="ml-1 text-xs text-fade">({t("current")})</span>}
                </td>
                <td className="px-1.5 py-1 text-ink">{r.nrDocument ?? "—"}</td>
                <td className="px-1.5 py-1 text-ink">{r.dateValidUntil ? formatDateRo(r.dateValidUntil) : "—"}</td>
                <td className="px-1.5 py-1">
                  {r.status && (
                    <span
                      className={`text-xs font-bold uppercase ${r.status.kind === "expired" ? "text-alert" : r.status.kind === "expiringSoon" ? "text-warning" : "text-success"}`}
                      data-identity-validity={r.status.kind}
                    >
                      {r.status.kind === "expired"
                        ? tValidity("expired")
                        : r.status.kind === "expiringSoon"
                          ? tValidity("expiringSoon", { n: r.status.days })
                          : tValidity("valid")}
                    </span>
                  )}
                </td>
                <td className="px-1.5 py-1">
                  <Link href={`/documents/${r.id}`} className="text-link underline underline-offset-2" data-identity-open="">
                    {r.code}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {legacyRows.length > 0 && (
        <div className="rounded-md border border-dashed border-wire px-3 py-2 text-sm" data-legacy-id-card="">
          <p className="text-fade">{t("legacyTitle")}</p>
          <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
            {legacyRows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-fade">{label}</dt>
                <dd className="break-all text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
