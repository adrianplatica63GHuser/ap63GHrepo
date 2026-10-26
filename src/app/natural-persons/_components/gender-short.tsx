"use client";

import { useTranslations } from "next-intl";

/**
 * Slice 40.79 — a person's gender in the list: „M" / „F", the whole word („Masculin", „Feminin") on hover and to a
 * screen reader. Its own file: the list view's source must end with its component (incursion-tile.test.tsx).
 */
export function GenderShort({ gender }: { gender: "MALE" | "FEMALE" }) {
  const t = useTranslations("naturalPerson");
  const full = t(`options.gender.${gender}`);
  return (
    <span title={full}>
      <span aria-hidden="true">{t(`options.genderShort.${gender}`)}</span>
      <span className="sr-only">{full}</span>
    </span>
  );
}
