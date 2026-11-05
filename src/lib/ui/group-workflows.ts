/**
 * „Cum lucrezi cu grupurile" asks first what you want to do.                                         (Slice 41.84)
 *
 * Adrian, 2026-11-04: „We would like to use the principles from the Calm technology and provide only the instructions
 * that are needed for the specific job at hand … a little bit of a wizard or a tile with radio buttons that is asking
 * the user basically “what do you want to do” … The options … should be documented with why the user would want to do
 * that". Two big parts — the group itself (find, make, describe, delete) and its members — and the big map's groups.
 *
 * Pure: which choices there are, under which heading, and which steps each shows. The tile is
 * src/components/screen/group-workflows-wizard.tsx; the words are messages' `group.workflows`.
 */

export type GroupWizardHeading = "self" | "members" | "map";
export type GroupWizardChoice = "find" | "create" | "describe" | "delete" | "members" | "map";
/** A step's words: the five of 41.44 under `group.workflows.steps`, the three new ones under `…wizard.steps`. */
export type GroupWizardStep = "find" | "create" | "describe" | "delete" | "members" | "mapShow" | "mapNew";

/** The choices, under their three headings, in reading order (Ask first 2). */
export const GROUP_WIZARD: readonly { heading: GroupWizardHeading; choices: readonly GroupWizardChoice[] }[] = [
  { heading: "self", choices: ["find", "create", "describe", "delete"] },
  { heading: "members", choices: ["members"] },
  { heading: "map", choices: ["map"] },
];

/**
 * Each choice's steps — only these are shown once it is chosen. Making, describing, deleting and the members start by
 * finding the group: making one says to search first, so the same group is not made twice.
 */
export const GROUP_WIZARD_STEPS: Readonly<Record<GroupWizardChoice, readonly GroupWizardStep[]>> = {
  find: ["find"],
  create: ["find", "create"],
  describe: ["find", "describe"],
  delete: ["find", "delete"],
  members: ["find", "members"],
  map: ["mapShow", "mapNew"],
};

/** The members' choice carries a note: a member can also be added or taken off on the record itself (41.44's „record"). */
export const GROUP_WIZARD_NOTE: Readonly<Partial<Record<GroupWizardChoice, "record">>> = { members: "record" };

/** The five steps 41.44 already words (`group.workflows.steps`); the others are the wizard's own. */
export const GROUP_STEPS_OF_41_44: readonly GroupWizardStep[] = ["find", "create", "members", "delete"];

/** Where the choice made is kept, per browser (Ask first 3). */
export const GROUP_WIZARD_KEY = "ga40-group-wizard-v1";

const CHOICES = new Set<string>(GROUP_WIZARD.flatMap((h) => h.choices));

/** A stored choice, or none — anything else stored there is no choice. */
export function readGroupWizardChoice(raw: string | null | undefined): GroupWizardChoice | null {
  return raw && CHOICES.has(raw) ? (raw as GroupWizardChoice) : null;
}
