"use client";

/**
 * „Recompune" under „Descrierea obiectului".                    (Slice #38.49)
 *
 * The contract de vânzare's description of what it sells is composed by rule
 * from its properties, its „Părți" and „Scop vânzare" (`/api/documents/[id]/
 * sale-object`, `sale-object-description.ts`). This button writes it into the
 * field again, over whatever is there — the screen's „Scop vânzare" is sent,
 * saved or not — and it is a change like any other, saved with „Salvează".
 * When the contract is opened for editing with the field empty, the field is
 * filled once WITHOUT marking the form changed: the screen shows the
 * description, and it is stored with the next „Salvează". Opening a contract
 * never raises „Modificări nesalvate" by itself.
 *
 * Nothing composed (no property, no share, no scope worth saying): the field
 * is left as it is, and a line says why.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";

export async function fetchSaleObjectText(documentId: string, scop: string | null | undefined): Promise<string> {
  const url = new URL(`/api/documents/${encodeURIComponent(documentId)}/sale-object`, window.location.origin);
  url.searchParams.set("scop", scop ?? "");
  const res = await fetch(url);
  if (res.redirected || !res.ok) throw new Error(`Request failed (${res.status})`);
  const body = (await res.json()) as { text?: unknown };
  return typeof body.text === "string" ? body.text : "";
}

export function SaleObjectRecompose({
  documentId,
  scop,
  value,
  editable,
  onText,
}: {
  documentId: string;
  /** The screen's „Scop vânzare". */
  scop: string | null | undefined;
  /** The field's value now. */
  value: string | null | undefined;
  /** In edit mode: the button shows, and an empty field fills itself once. */
  editable: boolean;
  /** `recompose`: the button, a change to save. `auto`: the empty field filled on opening, not a change. */
  onText: (text: string, how: "recompose" | "auto") => void;
}) {
  const t = useTranslations("document.saleObject");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<"nothing" | "failed" | null>(null);

  const recompose = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const text = await fetchSaleObjectText(documentId, scop);
      if (text) onText(text, "recompose");
      else setNote("nothing");
    } catch {
      setNote("failed");
    } finally {
      setBusy(false);
    }
  }, [documentId, scop, onText]);

  // An empty field is filled once, when the contract is opened for editing.
  //
  // ⚠️ **The request is never cancelled by a later render** — the screen's first renders change `editable` as the
  // versions load, and #38.49's first version dropped the answer on that cleanup, then never asked again (measured
  // on the runner: one call, the text returned, the field left empty). The answer is applied when it arrives, if the
  // field is still editable and still empty THEN — read from `latest`, not from the render that asked.
  const filled = useRef(false);
  const latest = useRef({ editable, value });
  useEffect(() => {
    latest.current = { editable, value };
  });
  useEffect(() => {
    if (!editable || filled.current || (value ?? "").trim() !== "") return;
    filled.current = true;
    fetchSaleObjectText(documentId, scop)
      .then((text) => {
        const now = latest.current;
        if (text && now.editable && (now.value ?? "").trim() === "") onText(text, "auto");
      })
      .catch(() => undefined);
  }, [editable, value, documentId, scop, onText]);

  if (!editable) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" data-sale-object-recompose="">
      <IconButton
        icon={RefreshCw}
        label={t("recompose")}
        showLabel
        variant="secondary"
        size="sm"
        busy={busy}
        busyLabel={t("recomposing")}
        onClick={() => void recompose()}
      />
      {note && <span className="text-xs italic text-fade">{t(note)}</span>}
    </div>
  );
}
