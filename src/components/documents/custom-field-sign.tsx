"use client";

/**
 * The sign between „Tip document:" and „Câmp specific:".         (Slice #38.18)
 *
 * Adrian: the control itself did not show clearly enough whether it could be
 * used. A green circle with a check (CircleCheck) when it can; a red circle
 * with a bar (Ban) when it cannot. Its tooltip — opened by hover and by
 * keyboard focus, through the app's one tooltip (`IconTooltip`) — says the
 * state and, when disabled, the reason for this case; when enabled, which
 * type's fields it offers. Colour is never the only carrier: the two icons
 * differ in shape, and the sign's name (`aria-label`) says the state and the
 * reason. The ⓘ beside the control keeps answering what it is for (#38.18's
 * Ask first).
 */
import { Ban, CircleCheck } from "lucide-react";
import { IconTooltip } from "@/lib/ui/icon-button";
import type { CustomFieldState } from "@/lib/documents/type-filter";

export function CustomFieldSign({ state, title, note }: { state: CustomFieldState; title: string; note: string }) {
  const Icon = state.enabled ? CircleCheck : Ban;
  return (
    <IconTooltip label={title} note={note}>
      <span
        role="img"
        tabIndex={0}
        aria-label={`${title}. ${note}`}
        data-custom-field-sign={state.enabled ? "on" : "off"}
        data-custom-field-reason={state.reason ?? undefined}
        className="inline-flex rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Icon
          aria-hidden="true"
          size={20}
          strokeWidth={2.25}
          className={state.enabled ? "text-success dark:text-success-dark" : "text-danger dark:text-danger-dark"}
        />
      </span>
    </IconTooltip>
  );
}
