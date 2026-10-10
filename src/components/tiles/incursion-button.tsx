"use client";

/**
 * „Incursiune" — the eye on a row of the four principal lists.      (Slice #38.72)
 *
 * Between the magnifier („Previzualizare", #38.71) and the right arrow („Deschide"): Adrian's order. A TOGGLE
 * with the magnifier's pressed look — the navy fill, a white icon — and `aria-pressed`; its name and tooltip
 * are „Incursiune" (en-GB „Peek inside", Ask first #3). Pressed, it shows the row's tile beside the list
 * (`ListPreviews`); pressed again, it closes it. Drawn only on a list that offers an Incursiune.
 */
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/lib/ui/icon-button";
import { previewKey, type PreviewTarget } from "@/lib/ui/previews";
import { useIncursion } from "./incursion-context";

export function IncursionButton({ target }: { target: PreviewTarget }) {
  const incursion = useIncursion();
  const t = useTranslations("shared.incursion");
  if (!incursion) return null;
  const pressed = incursion.open !== null && previewKey(incursion.open) === previewKey(target);
  return (
    <IconButton
      icon={Eye}
      label={t("button")}
      variant={pressed ? "primary" : "secondary"}
      size="xs"
      aria-pressed={pressed}
      data-incursion-toggle=""
      onClick={(e) => {
        e.stopPropagation();
        incursion.toggle(target);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}
