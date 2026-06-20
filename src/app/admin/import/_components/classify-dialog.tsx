"use client";

/**
 * ClassifyDialog — Slice #14.15.01.
 *
 * Opened from ImportBrowser with the File[] resolved from the user's
 * current selection (in click order). Shows a 3-way chooser:
 *
 *  - Property: enabled only for exactly one .txt file (Stereo70 corners).
 *  - Person:   enabled only for exactly one image file (ID card scan).
 *  - Document: always enabled for >=1 file — files become pages of one
 *              new Document, ordered exactly as selected.
 *
 * Each branch is its own panel component that performs the actual API
 * orchestration and navigates away on success (calling onClose() first).
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { isImage, isTextFile } from "./import-browser";
import { PropertyClassifyPanel } from "./property-classify-panel";
import { DocumentClassifyPanel } from "./document-classify-panel";
import { PersonClassifyPanel } from "./person-classify-panel";

type Branch = "choice" | "property" | "person" | "document";

type Props = {
  files: File[];
  onClose: () => void;
};

export function ClassifyDialog({ files, onClose }: Props) {
  const t = useTranslations("adminImport.classify");
  const [branch, setBranch] = useState<Branch>("choice");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (branch !== "choice") {
        setBranch("choice");
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [branch, onClose]);

  const propertyEligible = files.length === 1 && isTextFile(files[0]);
  const personEligible = files.length === 1 && isImage(files[0]);
  const documentEligible = files.length >= 1;

  const title =
    files.length === 1
      ? t("title", { name: files[0].name })
      : t("titleMultiple", { count: files.length });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-card-rim bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-700">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancel")}
            className="rounded p-1 text-fade hover:bg-canvas dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-5 py-5">
          {branch === "choice" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-fade">{t("chooseTypeHint")}</p>

              <ChoiceCard
                title={t("optionProperty")}
                hint={propertyEligible ? t("optionPropertyHint") : t("optionPropertyDisabledHint")}
                disabled={!propertyEligible}
                onClick={() => setBranch("property")}
              />
              <ChoiceCard
                title={t("optionPerson")}
                hint={personEligible ? t("optionPersonHint") : t("optionPersonDisabledHint")}
                disabled={!personEligible}
                onClick={() => setBranch("person")}
              />
              <ChoiceCard
                title={t("optionDocument")}
                hint={t("optionDocumentHint")}
                disabled={!documentEligible}
                onClick={() => setBranch("document")}
              />
            </div>
          )}

          {branch === "property" && (
            <PropertyClassifyPanel
              file={files[0]}
              onBack={() => setBranch("choice")}
              onClose={onClose}
            />
          )}

          {branch === "person" && (
            <PersonClassifyPanel
              file={files[0]}
              onBack={() => setBranch("choice")}
              onClose={onClose}
            />
          )}

          {branch === "document" && (
            <DocumentClassifyPanel
              files={files}
              onBack={() => setBranch("choice")}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  title,
  hint,
  disabled,
  onClick,
}: {
  title: string;
  hint: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex flex-col rounded-lg border-2 px-4 py-3 text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-wire bg-canvas opacity-60 dark:border-zinc-800 dark:bg-zinc-800/50"
          : "border-wire bg-white hover:border-cta hover:bg-cta-pale dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-cta",
      ].join(" ")}
    >
      <span className="font-medium">{title}</span>
      <span className="mt-0.5 text-xs text-fade">{hint}</span>
    </button>
  );
}
