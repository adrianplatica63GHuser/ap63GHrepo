"use client";

/**
 * The import's tarla step: a plan parcelar's tarla, proposed, confirmed by a person.            (Slice #39.69)
 *
 * The run read the plan (POST /api/documents/[id]/tarla-plan) and queued this step after the parties. It shows what
 * the plan names — the tarla's code, its locality and county, its parcels with their areas and uses — and proposes:
 *
 *   - „Leagă planul de tarla" when that code already exists in that locality (the per-locality identity of #39.67,
 *     `tarlaPlanProposal`), adding the parcels it does not have yet;
 *   - „Creează tarla și leagă planul" when it does not;
 *   - „Sari peste" always.
 *
 * The code, locality and county can be corrected before pressing, and the proposal follows the correction. Nothing
 * is written before the press (D-12); the press is one POST (/api/tarlale/from-plan), one transaction. No owner is
 * shown or kept: the reading carries none (src/lib/tarla/plan-read.ts).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/lib/ui/icon-button";
import { TARLA, boxStyle } from "@/lib/ui/field-widths";
import { SecondaryButton, PrimaryButton } from "@/components/persons/person-resolution-dialog";
import { tarlaLabel } from "@/lib/tarla/label";
import { tarlaPlanProposal, type TarlaPlanReading } from "@/lib/tarla/plan-read";
import { applyTarlaPlanRequest, type TarlaPlanRowState } from "@/lib/tarla/plan-step";
import type { TarlaListItem } from "@/lib/tarla/types";

const BOX =
  "mt-1 rounded-md border border-wire bg-card px-2 py-1 text-sm text-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

type Props = {
  documentId: string;
  /** The document's row label, under the heading. */
  label: string;
  reading: TarlaPlanReading;
  /** Called once, with what happened; the import moves to the next step. */
  onDone: (state: TarlaPlanRowState) => void;
};

export function TarlaPlanDialog({ documentId, label, reading, onDone }: Props) {
  const t = useTranslations("adminImport.tarlaPlan");
  const [code, setCode] = useState(reading.tarla ?? "");
  const [locality, setLocality] = useState(reading.locality ?? "");
  const [county, setCounty] = useState(reading.county ?? "");
  const [tarlale, setTarlale] = useState<TarlaListItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/tarlale")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((b: { items: TarlaListItem[] }) => live && setTarlale(b.items))
      .catch(() => live && setTarlale([]));
    return () => {
      live = false;
    };
  }, []);

  const trimmed = code.trim();
  const proposal = useMemo(
    () => tarlaPlanProposal(trimmed === "" ? null : trimmed, locality.trim() || null, tarlale ?? []),
    [trimmed, locality, tarlale],
  );
  const shownCode = trimmed || "–";

  async function confirm() {
    if (trimmed === "") return;
    setBusy(true);
    setFailed(false);
    const res = await applyTarlaPlanRequest({
      documentId,
      indicativ: trimmed,
      locality: locality.trim() || null,
      county: county.trim() || null,
      parcels: reading.parcels,
    });
    setBusy(false);
    if (!res.ok) {
      setFailed(true);
      return;
    }
    onDone({ status: res.created ? "created" : "linked", code: trimmed, tarlaId: res.tarlaId, parcelsAdded: res.parcelsAdded });
  }

  const notes = [
    ...(reading.illegibleParcels > 0 ? [t("illegibleParcels", { count: reading.illegibleParcels })] : []),
    ...(reading.duplicatesDropped > 0 ? [t("duplicatesDropped", { count: reading.duplicatesDropped })] : []),
    ...(reading.locality === null ? [t("noLocality")] : []),
    ...reading.unread,
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tarla-plan-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-tarla-plan-step=""
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="tarla-plan-title" className="text-base font-semibold text-ink dark:text-zinc-100">
              {t("title")}
            </h3>
            <p className="mt-0.5 text-sm text-fade dark:text-zinc-400">{label}</p>
          </div>
          <IconButton
            icon={X}
            label={t("close")}
            variant="bare"
            size="md"
            onClick={() => onDone(trimmed === "" ? { status: "no-code" } : { status: "skipped", code: trimmed })}
            disabled={busy}
          />
        </div>

        <p className="mt-3 text-sm text-fade dark:text-zinc-400">{t("intro")}</p>

        <div className="mt-3 flex flex-wrap gap-4">
          <label className="block text-sm">
            <span className="block text-xs font-medium text-fade">{t("fields.indicativ")}</span>
            <input
              type="text"
              className={BOX}
              style={boxStyle(TARLA.indicativ)}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              data-tarla-plan-code=""
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-fade">{t("fields.locality")}</span>
            <input
              type="text"
              className={BOX}
              style={boxStyle(TARLA.locality)}
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-fade">{t("fields.county")}</span>
            <input
              type="text"
              className={BOX}
              style={boxStyle(TARLA.county)}
              value={county}
              onChange={(e) => setCounty(e.target.value)}
            />
          </label>
        </div>

        <p className="mt-3 text-sm text-ink dark:text-zinc-200" data-tarla-plan-proposal={tarlale === null ? "loading" : proposal.action}>
          {tarlale === null
            ? t("checking")
            : proposal.action === "link"
              ? t.rich("proposalLink", {
                  label: tarlaLabel(proposal.tarla),
                  open: (chunks) => (
                    <Link href={`/tarlale/${proposal.tarla.id}`} target="_blank" className="underline">
                      {chunks}
                    </Link>
                  ),
                })
              : proposal.action === "create"
                ? t("proposalCreate", { label: tarlaLabel({ indicativ: shownCode, locality: locality.trim() || null }) })
                : t("proposalNone")}
        </p>

        {notes.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-amber-800 dark:text-amber-400" data-tarla-plan-unread="">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}

        <h4 className="mt-4 text-sm font-semibold text-ink dark:text-zinc-100">
          {t("parcels", { count: reading.parcels.length })}
        </h4>
        {reading.parcels.length === 0 ? (
          <p className="mt-1 text-sm text-fade dark:text-zinc-400">{t("parcelsNone")}</p>
        ) : (
          <div className="mt-1 max-h-60 overflow-y-auto rounded-md border border-wire dark:border-zinc-700">
            <table className="w-full text-sm" data-tarla-plan-parcels="">
              <thead className="sticky top-0 bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-fade dark:bg-zinc-950">
                <tr>
                  <th className="px-3 py-1.5">{t("columns.parcela")}</th>
                  <th className="px-3 py-1.5 text-right">{t("columns.area")}</th>
                  <th className="px-3 py-1.5">{t("columns.use")}</th>
                </tr>
              </thead>
              <tbody>
                {reading.parcels.map((p) => (
                  <tr key={p.parcela} className="border-t border-crease dark:border-zinc-800">
                    <td className="px-3 py-1">{p.parcela}</td>
                    <td className="px-3 py-1 text-right tabular-nums">
                      {p.areaSqm === null ? "–" : p.areaSqm.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-1">{p.use ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {failed && (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
            {t("failed")}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton
            onClick={() => onDone(trimmed === "" ? { status: "no-code" } : { status: "skipped", code: trimmed })}
            disabled={busy}
          >
            {t("skip")}
          </SecondaryButton>
          <PrimaryButton onClick={() => void confirm()} disabled={busy || tarlale === null || proposal.action === "none"}>
            {busy ? t("saving") : proposal.action === "link" ? t("link") : t("create")}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
