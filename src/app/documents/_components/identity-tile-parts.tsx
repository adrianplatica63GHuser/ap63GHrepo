"use client";

/**
 * The identity tile's two parts that are not fields.                     (Slice 40.83)
 *
 * - `IdentityHolderLine` — the holder (role „Titular act de identitate") in the tile's heading row, linked to the
 *   person; nothing while none is linked.
 * - `IdentityValidity` — VALABIL / EXPIRAT / EXPIRĂ ÎN n ZILE beside „Valabil până la", in the person tile's words
 *   and colours (40.79); nothing on a kind with no validity end (tip vechi), or with the date empty.
 *
 * The fields themselves are the document form's own (document-form.tsx), so they read, edit, frame and pulse like
 * every other field of the record. Colours are role tokens (colour-tokens.test.ts).
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useTimeFrames, tfDays } from "@/hooks/use-time-frames";
import { ID_CARD_HOLDER_ROLE } from "@/lib/import/id-card-holder-role";
import { identityValidity } from "@/lib/identity-documents/form";

type PersonRow = { id: string; code: string; type: "NATURAL" | "JUDICIAL"; displayName: string; roleName: string | null };

async function fetchHolder(documentId: string): Promise<PersonRow | null> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/persons`);
  if (res.redirected || !res.ok) throw new Error(`HTTP ${res.status}`);
  const items = ((await res.json()) as { items?: PersonRow[] }).items ?? [];
  const want = ID_CARD_HOLDER_ROLE.toLocaleLowerCase("ro-RO");
  return items.find((p) => (p.roleName ?? "").trim().toLocaleLowerCase("ro-RO") === want) ?? null;
}

export function IdentityHolderLine({ documentId }: { documentId: string | null | undefined }) {
  const t = useTranslations("identityDocument");
  const { data: holder } = useQuery({
    queryKey: ["document-persons", documentId, "holder"],
    queryFn: () => fetchHolder(documentId!),
    enabled: !!documentId,
    staleTime: 0,
  });
  if (!documentId || !holder) return null;
  const href = holder.type === "NATURAL" ? `/natural-persons/${holder.id}` : `/judicial-persons/${holder.id}`;
  return (
    <p className="text-sm text-fade" data-identity-holder="">
      {t("holder")}{" "}
      <Link href={href} className="text-link underline underline-offset-2">
        {holder.displayName}
      </Link>{" "}
      <span className="text-xs">({holder.code})</span>
    </p>
  );
}

export function IdentityValidity({ validUntil }: { validUntil: string | null | undefined }) {
  const t = useTranslations("identityDocument.validity");
  const { data: tf } = useTimeFrames();
  const status = identityValidity(validUntil, new Date(), tfDays(tf, "id_card_expiring_soon"));
  if (!status) return null;
  const [cls, text] =
    status.kind === "expired"
      ? ["text-alert", t("expired")]
      : status.kind === "expiringSoon"
        ? ["text-warning", t("expiringSoon", { n: status.days })]
        : ["text-success", t("valid")];
  return (
    <span className={`text-xs font-bold uppercase ${cls}`} data-identity-validity={status.kind}>
      {text}
    </span>
  );
}
