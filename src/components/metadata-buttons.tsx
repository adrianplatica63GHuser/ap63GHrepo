"use client";

/**
 * The META INFO tab's two toggles, as icon buttons.               (Slice #37.44)
 *
 * Apart from `entity-metadata-tab.tsx` so they can be rendered under Jest
 * without that file's queries and next-intl: they take their words as props.
 *
 * TOGGLES SHOW THEIR STATE IN THE ICON (Adrian, A031 and A032):
 *  - „Marchează ca verificat" is BadgeCheck — outlined until it has been
 *    pressed, filled while „✓ Verificat" shows; its name and tooltip follow
 *    the three words it had (mark, marking, marked).
 *  - The add buttons of Grupuri, Ștampile and „Vezi și" are their icon while
 *    closed (Plus; Link for a cross-reference, A039) and ChevronUp while their
 *    picker is open — where they showed „▲", which now has a name of its own.
 */

import { BadgeCheck, ChevronUp, type LucideIcon, type LucideProps } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";

/** BadgeCheck filled: the badge in the button's colour, the check cut out of it in white. */
export function FilledBadgeCheck(props: LucideProps) {
  return <BadgeCheck {...props} fill="currentColor" stroke="white" data-filled="" />;
}

export function MarkReviewedButton({
  reviewed,
  reviewing,
  labels,
  onClick,
}: {
  reviewed: boolean;
  reviewing: boolean;
  labels: { mark: string; marking: string; marked: string };
  onClick: () => void;
}) {
  return (
    <IconButton
      icon={reviewed ? FilledBadgeCheck : BadgeCheck}
      label={reviewed ? labels.marked : labels.mark}
      busy={reviewing}
      busyLabel={labels.marking}
      variant="secondary"
      size="md"
      aria-pressed={reviewed}
      onClick={onClick}
      disabled={reviewing || reviewed}
    />
  );
}

export function AddToggleButton({
  open,
  icon,
  labelAdd,
  labelHide,
  onClick,
}: {
  open: boolean;
  /** The closed state's icon: Plus, or Link for a cross-reference. */
  icon: LucideIcon;
  labelAdd: string;
  /** The name of the open state, which showed a bare „▲". */
  labelHide: string;
  onClick: () => void;
}) {
  return (
    <IconButton
      icon={open ? ChevronUp : icon}
      label={open ? labelHide : labelAdd}
      variant="bare"
      size="md"
      aria-expanded={open}
      onClick={onClick}
    />
  );
}
