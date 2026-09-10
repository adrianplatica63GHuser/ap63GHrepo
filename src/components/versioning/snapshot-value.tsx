"use client";

// ---------------------------------------------------------------------------
// SnapshotValue — what a version prints when the picker cannot offer its value
//                                                                (Slice #34.17)
// ---------------------------------------------------------------------------
//
// A historical version is strictly read-only (`effectiveMode` resolves to
// "view" on anything but the latest), and two of the five states in
// `resolveSnapshotLookup` are values a `<select>` has no option for: an id
// whose lookup row an admin deleted, and the pre-#34.03 tarla TEXT a snapshot
// still carries with no id to resolve it to. Both used to render as an empty
// box. This renders them instead, in place of the picker.
//
// ⚠️ **It renders a value, never a control.** The deleted id stays out of the
// DOM entirely — a disabled `<option>` carrying it would put a dangling uuid
// one `form.setValue` away from a save, which is the hole
// `optionsWithUnlistedValues` left and Slice #34.03 closed by deleting it.
//
// Labels arrive already-localised, so this component is namespace-agnostic —
// the same contract `VersionNavControls` has had since Slice #18.05. Returns
// `null` for the three states the picker handles itself, so a caller that
// renders it unconditionally degrades to nothing rather than to a wrong label;
// callers decide WHICH of the two to render with `snapshotReplacesPicker`.

import type { SnapshotLookupState } from "@/lib/versioning/snapshot-lookup";

// Matches the disabled `<select>` beside it: same box, same muted ink, no
// focus ring. `className` carries the version diff frame from `usePulseRing`,
// which a printed value earns exactly as the picker did.
const BOX =
  "w-full rounded-md border border-wire bg-canvas px-2 py-1 shadow-sm text-fade " +
  "dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";

export function SnapshotValue({
  state,
  deletedLabel,
  className,
}: {
  state: SnapshotLookupState;
  /** Already-localised „valoare ștearsă". */
  deletedLabel: string;
  /** The field's diff frame, if this version changed it. */
  className?: string;
}) {
  if (state.kind !== "deleted" && state.kind !== "recorded") return null;

  const deleted = state.kind === "deleted";
  return (
    <div
      // The deleted label is PROSE about the value; a recorded text IS the
      // value. Italics are the only thing telling the user which one they are
      // reading, so that a lookup row somebody actually named "valoare
      // ștearsă" would still be distinguishable from the row that is gone.
      className={[BOX, deleted ? "italic" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {deleted ? deletedLabel : state.text}
    </div>
  );
}
