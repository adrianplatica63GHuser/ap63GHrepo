"use client";

import { useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import { PANEL_UNIT_STYLE } from "@/lib/ui/field-widths";
import { TileTitle } from "@/components/tiles/tile-title";

/**
 * `linkId` is `person_document.id` (#36.02). This panel reads the same endpoint
 * as the Persons tab, so the same person can now appear twice in it — and both
 * the React key and the remove button used the PERSON id, which after the
 * widening collides the key and removes both rows. Neither is about succession
 * as such; they are the same two lines the Persons tab needed.
 */
type PartyItem = {
  linkId:      string;
  id:          string;
  code:        string;
  type:        "NATURAL" | "JUDICIAL";
  displayName: string;
  /**
   * The party's role — „Defunct", „Moștenitor" or any role the certificate's
   * type offers. Until Slice #38.38 this was a separate QUALITY column with a
   * coloured badge per value; both values are roles now, so the panel reads the
   * same field every person ↔ document link carries.
   */
  roleName:    string | null;
};

type Props = {
  documentId: string;
  mode:       "edit" | "view";
  /** Slice #38.30: the line under „Părți" saying what the tile holds. */
  subtitle?:  string;
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchParties(documentId: string): Promise<PartyItem[]> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/persons`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as PartyItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SuccessionPartiesPanel({ documentId, mode, subtitle }: Props) {
  const t           = useTranslations("document.successionParties");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [removingId,  setRemovingId]  = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["document-persons", documentId],
    queryFn:  () => fetchParties(documentId),
  });

  const handleAddParty = () => {
    router.push(`/documents/${encodeURIComponent(documentId)}/associate-party`);
  };

  const handleRemove = async (item: PartyItem) => {
    setRemovingId(item.linkId);
    setRemoveError(null);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/persons/${encodeURIComponent(item.id)}`
          + `?linkId=${encodeURIComponent(item.linkId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["document-persons", documentId] });
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : t("removeError"));
    } finally {
      setRemovingId(null);
    }
  };

  const personHref = (item: PartyItem) => {
    const base = item.type === "NATURAL" ? "/natural-persons" : "/judicial-persons";
    return `${base}/${encodeURIComponent(item.id)}?readonly=true`;
  };

  return (
    // Slice #37.15: one fixed panel, like every panel on the Document — a
    // name that does not fit wraps inside its cell. Slice #37.31: 3 width
    // units, the fewest that hold Nume, Rol (Calitate until #38.38) and „Elimină".
    <section
      style={PANEL_UNIT_STYLE.document.succession}
      data-panel="succession-parties"
      className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <TileTitle title={t("sectionTitle")} subtitle={subtitle} />

      {isLoading ? (
        <p className="py-2 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>
      ) : isError ? (
        <p className="py-2 text-sm text-red-600 dark:text-red-400">{t("error")}</p>
      ) : !items || items.length === 0 ? (
        <p className="py-2 text-sm text-fade dark:text-zinc-400">{t("empty")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-rim dark:border-zinc-800">
              <th className="px-2 py-1.5 text-left font-semibold text-fade dark:text-zinc-400">{t("colName")}</th>
              <th className="px-2 py-1.5 text-left font-semibold text-fade dark:text-zinc-400">{t("colRole")}</th>
              {mode === "edit" && <th className="w-20 px-2 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.linkId}
                className="border-b border-card-rim last:border-0 dark:border-zinc-800"
              >
                <td className="px-2 py-1.5 font-medium text-ink dark:text-zinc-100">
                  <a
                    href={personHref(item)}
                    className="text-cta hover:underline dark:text-cta"
                    // Slice #37.21: Ctrl/⌘+click or a middle-click is the browser's own — a new tab.
                    onClick={(e) => { if (e.ctrlKey || e.metaKey || e.button !== 0) return; e.preventDefault(); router.push(personHref(item)); }}
                  >
                    {item.displayName}
                  </a>
                </td>
                <td className="px-2 py-1.5 text-ink dark:text-zinc-200" data-party-role>
                  {item.roleName || "—"}
                </td>
                {mode === "edit" && (
                  <td className="px-2 py-1.5 text-right">
                    <IconButton
                      icon={UserMinus}
                      label={t("remove")}
                      busy={removingId === item.linkId}
                      busyLabel={t("removing")}
                      variant="bare-danger"
                      size="xs"
                      onClick={() => void handleRemove(item)}
                      disabled={removingId === item.linkId}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {removeError && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">{removeError}</p>
      )}

      {mode === "edit" && (
        <div className="mt-3">
          {/* #37.44 (A040/A041): the icon in place of „+"; the words keep their „+" so the name
              stays the one every locator knows. */}
          <IconButton
            icon={UserPlus}
            label={`+ ${t("addButton")}`}
            variant="secondary"
            size="md"
            onClick={handleAddParty}
          />
        </div>
      )}
    </section>
  );
}
