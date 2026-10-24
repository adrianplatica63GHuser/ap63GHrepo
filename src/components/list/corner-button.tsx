"use client";

/**
 * A name cell's corner button — the column's funnel and its sort icon, in their two looks.               (Slice 40.48)
 *
 * Adrian, 2026-10-24: „a filtering icon that is not in use will display just like today but without the circle around
 * it - a filtering icon that is in use be solid Navy blue with the circle around it", and the sort icon the same way.
 * So both are drawn here, and cannot drift apart:
 *   - not in use — the glyph alone, `bare`: no border, no fill, in the colour the secondary drew it in (`text-cta`),
 *     darker on hover (Ask first 1);
 *   - in use — `IN_USE_CORNER`, 40.47's constant: navy in a navy circle, the glyph solid (the funnel filled, the sort
 *     arrow at a heavier stroke); dark mode a lighter blue (Ask first 2).
 * The 13-px corner square and its 20-px pressable area (`square="corner"`) either way; the name is the tooltip. A press
 * never reaches the cell under it, so it never starts a column drag.
 */
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { IN_USE_CORNER, buttonClass } from "@/lib/ui/button-styles";
import { IconTooltip, SQUARE_ICON_PX } from "@/lib/ui/icon-button";

export function CornerButton({
  icon: Icon,
  label,
  inUse,
  solid = "stroke",
  pressed,
  onPress,
}: {
  icon: ComponentType<LucideProps>;
  /** Its name and its tooltip. */
  label: string;
  inUse: boolean;
  /** In use, how the glyph turns solid: filled (the funnel), or at a heavier stroke (an arrow, which has no inside). */
  solid?: "fill" | "stroke";
  /** `aria-pressed`, for a toggle (the funnel); none for the sort icon, whose state is the <th>'s `aria-sort`. */
  pressed?: boolean;
  onPress: () => void;
}) {
  return (
    <IconTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        data-in-use={inUse ? "true" : "false"}
        className={buttonClass({
          variant: inUse ? "secondary" : "bare",
          size: "xs",
          iconOnly: true,
          square: "corner",
          className: `relative${inUse ? ` ${IN_USE_CORNER}` : ""}`,
        })}
        onClick={(e) => {
          e.stopPropagation();
          onPress();
        }}
      >
        <Icon
          size={SQUARE_ICON_PX.corner}
          aria-hidden="true"
          className="shrink-0"
          strokeWidth={inUse && solid === "stroke" ? 3.25 : 2}
          fill={inUse && solid === "fill" ? "currentColor" : "none"}
        />
      </button>
    </IconTooltip>
  );
}
