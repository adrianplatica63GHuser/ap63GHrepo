"use client";

/**
 * „†" after a dead person's name — on the lists, in the previews, in the pickers and in the inheritance tree.
 *                                                                                  (Slice #39.30)
 *
 * The genealogist's dagger, with „Decedat" as its tooltip and its accessible name. No change of colour: the mark
 * says it, and a dead person is still somebody the archive holds documents for.
 */
import { useTranslations } from "next-intl";
import { DECEASED_MARK } from "@/lib/persons/person-age";

export function DeceasedMark({ className = "" }: { className?: string }) {
  const t = useTranslations("naturalPerson.fields");
  const label = t("isDeceased");
  return (
    <span title={label} aria-label={label} role="img" className={`ml-1 ${className}`} data-deceased="">
      {DECEASED_MARK}
    </span>
  );
}
