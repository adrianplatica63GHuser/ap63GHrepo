/**
 * A record's kind, as its mark: the kind's icon, the kind's name its accessible name and its tooltip.    (Slice 40.61)
 *
 * Where a row said its kind in words — „Activitate recentă"'s grey monospace label, the global search's coloured chips
 * — it shows the mark (Ask first 3). Monospace stays for codes.
 */
import { ENTITY_ICON, type EntityKind } from "@/lib/ui/entity-icon";

export function EntityMark({ kind, label, size = 16 }: { kind: EntityKind; label: string; size?: number }) {
  const Icon = ENTITY_ICON[kind];
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex shrink-0 items-center text-fade dark:text-zinc-400"
      data-entity-mark={kind}
    >
      <Icon size={size} aria-hidden="true" />
    </span>
  );
}
