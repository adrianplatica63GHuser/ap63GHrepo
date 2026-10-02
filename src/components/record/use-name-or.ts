"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { UnnamedKind } from "@/lib/ui/unnamed";

/**
 * `nameOr(name, kind)`: the record's name, or — when it has none — words
 * („Act fără titlu", „Proprietate fără poreclă", „Persoană fără nume"); never
 * its system ID. (Slice #37.57; the ID's one place is the first panel's corner.)
 */
export function useNameOr(): (name: string | null | undefined, kind: UnnamedKind) => string {
  const t = useTranslations("shared.unnamed");
  return useCallback((name, kind) => (name && name.trim() ? name : t(kind)), [t]);
}
