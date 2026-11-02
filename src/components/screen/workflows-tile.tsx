"use client";

/**
 * HOW YOU WORK WITH GROUPS, AND WITH STAMPS — A SECOND INFORMATION TILE.                          (Slice 41.44)
 *
 * Adrian, 2026-11-01: „The workflows should be presented". Beside „Ce este un Grup?" / „Ce este o Ștampilă?", on the
 * Grupuri and Ștampile screens and on one group's and one stamp's screen: each workflow as a short heading and one to
 * three sentences — finding one, making one, adding records and taking them off (from its screen and from a record's
 * „Etichete și grupuri"), deleting one — each button named by its exact label. On the first tile's information surface
 * and with a tile's heading (TileTitle), a tile of its own in each screen's registry („workflows"), shown by default.
 *
 * The text is `<kind>.workflows` in the messages; workflows-labels.test.ts holds every label it quotes to a screen
 * string, so the tile cannot drift from the screen in silence.
 */
import { useId } from "react";
import { useTranslations } from "next-intl";
import { TileTitle } from "@/components/tiles/tile-title";
import { screenPanel } from "@/lib/ui/field-widths";

/** The workflows, in reading order — each `<kind>.workflows.steps.<key>.{title,body}`. */
export const WORKFLOW_STEPS = ["find", "create", "members", "record", "delete"] as const;
/** As wide as „Ce este …?" (7 units). */
export const WORKFLOWS_UNITS = 7;

const SURFACE = {
  group: "rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-900 dark:bg-blue-950/40",
  stamp: "rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900 dark:bg-amber-950/40",
} as const;
const TEXT = {
  group: "text-blue-800 dark:text-blue-300",
  stamp: "text-amber-800 dark:text-amber-300",
} as const;

export function WorkflowsTile({ kind, hidden = false }: { kind: "group" | "stamp"; hidden?: boolean }) {
  const t = useTranslations(kind === "group" ? "group.workflows" : "stamp.workflows");
  const titleId = useId();
  return (
    <section
      {...screenPanel(`${kind}-workflows`, WORKFLOWS_UNITS)}
      data-tile="workflows"
      hidden={hidden}
      aria-labelledby={titleId}
      className={SURFACE[kind]}
    >
      <TileTitle id={titleId} title={t("title")} className="mb-3" />
      <ol className={`flex flex-col gap-2.5 text-sm ${TEXT[kind]}`}>
        {WORKFLOW_STEPS.map((key) => (
          <li key={key} data-workflow-step={key}>
            <p className="font-semibold">{t(`steps.${key}.title`)}</p>
            <p>{t(`steps.${key}.body`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
