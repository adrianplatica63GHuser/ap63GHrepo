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
import { WorkflowsWizard } from "@/components/screen/group-workflows-wizard";

/** 41.44's workflows, each `<kind>.workflows.steps.<key>.{title,body}` — the steps the wizards quote (41.84, 41.99). */
export const WORKFLOW_STEPS = ["find", "create", "members", "record", "delete"] as const;
/** As wide as „Ce este …?" (7 units) — on a group's and a stamp's own screen. */
export const WORKFLOWS_UNITS = 7;
/**
 * Slice 41.98 — Adrian: „“How you work with groups” which starts at size three units width". On Grupuri (41.99: and
 * Ștampile) the wizard is 3 units, the list beside it.
 */
export const LIST_SCREEN_WORKFLOWS_UNITS = 3;

/**
 * Slice 41.84: the group's tile asks first what you want to do (group-workflows-wizard.tsx). Slice 41.99: so does the
 * stamp's — one wizard for both kinds; 41.44's list of every step (`WorkflowsList`) went.
 */
export function WorkflowsTile({ kind, hidden = false, units = WORKFLOWS_UNITS }: { kind: "group" | "stamp"; hidden?: boolean; units?: number }) {
  return <WorkflowsWizard kind={kind} units={units} hidden={hidden} />;
}
