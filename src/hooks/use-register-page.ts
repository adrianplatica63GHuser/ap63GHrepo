// ---------------------------------------------------------------------------
// useRegisterPage  (Slice #20.17)
// ---------------------------------------------------------------------------
//
// Call this once in any entity detail client component to:
//   1. Register the entity's display label in the breadcrumb pageLabels cache
//   2. Push the entity onto the recently-viewed list in the sidebar
//
// Parameters:
//   label       — display name shown in breadcrumbs and recently-viewed list
//                 (e.g. "Teren Nord-Vest" or "Popescu Ion")
//   code        — entity code chip (e.g. "PROP00003")
//   entityType  — one of NATURAL_PERSON | JUDICIAL_PERSON | PROPERTY | DOCUMENT
//
// Example:
//   useRegisterPage(propertyName, propertyCode, "PROPERTY");

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  useNavigationHistory,
  type EntityType,
} from "@/components/providers/navigation-history-provider";

export function useRegisterPage(
  label:      string,
  code:       string,
  entityType: EntityType,
): void {
  const pathname    = usePathname();
  const { registerPage } = useNavigationHistory();

  useEffect(() => {
    if (!label || !code) return;
    registerPage(pathname, label, code, entityType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, label, code, entityType]);
}
