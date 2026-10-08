"use client";

/**
 * „Creează persoane din CI" on an identity card's own screen.     (Slice #38.44)
 *
 * The import's „Creează persoană din CI", opened on a card already in the
 * archive (Ask first 1): its first page is read, the holder is confirmed or
 * created — an existing person is found by CNP, so no duplicate is made — and
 * the father and mother are offered after it. With no property in sight, the
 * holder is linked to this Document only, in „Titular act de identitate"
 * (`id-card-holder-role.ts`); the parents are linked to the holder.
 *
 * The read is the same paid call the import makes, so nothing happens until
 * the button is pressed, and the button is drawn only on a card's screen.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { IdCardPersonDialog, type IdCardPersonOutcome } from "@/app/admin/import/_components/id-card-person-dialog";
import { cardImageFromFile } from "@/app/admin/import/_components/id-card-image";
import { parentOutcomeSentences } from "@/lib/import/id-card-parents";

type PageRow = { id: string; pageNumber: number | null; fileName: string | null; mimeType: string | null };

/** The card's first page, as a File the extract route takes. */
async function firstPageImage(documentId: string): Promise<File> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/pages`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const pages = ((await res.json()) as PageRow[]).slice().sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0));
  const first = pages[0];
  if (!first) throw new Error("no-page");
  const view = await fetch(
    `/api/documents/${encodeURIComponent(documentId)}/pages/${encodeURIComponent(first.id)}/view`,
  );
  if (!view.ok) throw new Error(`HTTP ${view.status}`);
  const { url, fileName, mimeType } = (await view.json()) as { url: string; fileName: string | null; mimeType: string | null };
  const blob = await (await fetch(url)).blob();
  const file = new File([blob], fileName ?? "pagina-1", { type: mimeType ?? blob.type });
  return cardImageFromFile(file);
}

export function IdCardPeopleAction({ documentId, title }: { documentId: string; title: string }) {
  const t = useTranslations("document.idCardPeople");
  const tParents = useTranslations("parentsFromIdCard");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "noPage" | "error">("idle");
  const [done, setDone] = useState<string[] | null>(null);

  async function open() {
    setDone(null);
    setState("loading");
    try {
      setFile(await firstPageImage(documentId));
      setState("idle");
    } catch (err) {
      setState(err instanceof Error && err.message === "no-page" ? "noPage" : "error");
    }
  }

  function finished(outcome: IdCardPersonOutcome) {
    setFile(null);
    setDone([
      t(outcome.created ? "holderCreated" : "holderLinked"),
      ...parentOutcomeSentences(outcome.parents, (key, values) => tParents(key, values)),
    ]);
    void queryClient.invalidateQueries();
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-1" data-id-card-people="">
      <IconButton
        icon={UserPlus}
        label={state === "loading" ? t("loading") : t("action")}
        showLabel
        variant="secondary"
        size="lg"
        busy={state === "loading"}
        onClick={() => void open()}
        disabled={state === "loading" || file !== null}
      />
      {state === "noPage" && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t("noPage")}</p>}
      {state === "error" && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t("error")}</p>}
      {done && (
        <ul role="status" className="text-xs text-emerald-700 dark:text-emerald-400" data-id-card-people-done="">
          {done.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {file && (
        <IdCardPersonDialog
          file={file}
          entryLabel={title}
          propertyId={null}
          documentId={documentId}
          onDone={finished}
          onFailed={() => setState("error")}
          onClose={() => setFile(null)}
        />
      )}
    </div>
  );
}
