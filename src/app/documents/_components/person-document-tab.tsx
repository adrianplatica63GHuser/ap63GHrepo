"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/lib/ui/button-styles";

/**
 * ⚠️ **`linkId` IS THE ROW AND `id` IS THE DOCUMENT.**          (Slice #36.02)
 * The mirror of `document-persons-tab.tsx`, one axis over: a person holding two
 * roles on one document makes that document appear twice in this list, and `id`
 * names both rows. Everything that identifies a row — the key, the selection,
 * the DELETE — uses `linkId`; `id` is what „Vizualizare" navigates to.
 *
 * The cotă is read but not shown here, deliberately: it is edited on the
 * DOCUMENT's Persons tab, where the whole deed's rows sit together and the
 * per-role total means something. A share rendered next to a single document,
 * with no siblings to add up against, would be a number with no context.
 */
type AssociatedDocument = {
  linkId:       string;
  id:           string;
  code:         string;
  typeName:     string | null;
  title:        string | null;
  roleName:     string | null;
  associatedAt: string;
};

type Props = {
  personId: string;
  /** "/natural-persons" or "/judicial-persons" — used for the Associate button route */
  backBase: string;
};

async function fetchPersonDocuments(personId: string): Promise<AssociatedDocument[]> {
  const res = await fetch(`/api/people/${encodeURIComponent(personId)}/documents`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedDocument[];
}

export function PersonDocumentTab({ personId, backBase }: Props) {
  const t           = useTranslations("shared.document");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [dissociating,  setDissociating]  = useState(false);
  const [dissociateErr, setDissociateErr] = useState<string | null>(null);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["person-documents", personId],
    queryFn:  () => fetchPersonDocuments(personId),
  });

  const handleAssociate = () => {
    router.push(`${backBase}/${encodeURIComponent(personId)}/associate-document`);
  };

  const handleDissociate = async () => {
    if (!selectedId) return;
    const target = items?.find((i) => i.linkId === selectedId);
    if (!target) return;
    setDissociating(true);
    setDissociateErr(null);
    try {
      // ⚠️ `linkId` is REQUIRED by the route, and that is the fix: addressed at
      // the (person, document) pair this removed every role the person held on
      // that document rather than the one selected.
      const res = await fetch(
        `/api/people/${encodeURIComponent(personId)}/documents/${encodeURIComponent(target.id)}`
          + `?linkId=${encodeURIComponent(target.linkId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["person-documents", personId] });
    } catch (err) {
      setDissociateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setDissociating(false);
    }
  };

  if (isLoading) return <p className="py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>;
  if (isError)   return <p className="py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {items && items.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="w-8 px-3 py-2" aria-label="select" />
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colType")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colTitle")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colRole")}</th>
                <th className="w-16 px-3 py-2" aria-label="view" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.linkId}
                  onClick={() => setSelectedId(item.linkId === selectedId ? null : item.linkId)}
                  onDoubleClick={() => router.push(`/documents/${encodeURIComponent(item.id)}?readonly=true`)}
                  className={[
                    "cursor-pointer border-b border-card-rim last:border-0 dark:border-zinc-800",
                    item.linkId === selectedId
                      ? "bg-cta-pale dark:bg-cta/10"
                      : "hover:bg-canvas dark:hover:bg-zinc-800/50",
                  ].join(" ")}
                >
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      checked={item.linkId === selectedId}
                      onChange={() => setSelectedId(item.linkId)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`${item.title ?? item.code} — ${item.roleName ?? "\u2014"}`}
                      className="accent-cta"
                    />
                  </td>
                  <td className="px-3 py-2 text-fade dark:text-zinc-400">{item.typeName ?? "—"}</td>
                  <td className="px-3 py-2 text-ink dark:text-zinc-100">{item.title ?? "—"}</td>
                  <td className="px-3 py-2 text-fade dark:text-zinc-400">{item.roleName ?? "—"}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/documents/${encodeURIComponent(item.id)}?readonly=true`);
                      }}
                      className={buttonClass({ variant: "secondary", size: "xs" })}
                    >
                      {t("view")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("empty")}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAssociate}
            disabled={selectedId !== null}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t("associate")}
          </button>
          <button
            type="button"
            onClick={handleDissociate}
            disabled={selectedId === null || dissociating}
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {dissociating ? t("dissociating") : t("dissociate")}
          </button>
        </div>
        {dissociateErr && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{dissociateErr}</p>
        )}
      </div>
    </div>
  );
}
