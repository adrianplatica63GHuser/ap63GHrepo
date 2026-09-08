/**
 * The subtraction between what a role picker OFFERS and what a row CARRIES.
 *                                                              (Slice #34.05)
 *
 * ⚠️ **ITS OWN MODULE, WITH NO IMPORTS, AND THAT IS DELIBERATE.** Its sibling
 * `./carried-roles.ts` imports `@/db`, and `src/hooks/use-lookup-options.ts`
 * imports React Query and next-intl; this rule is neither a database read nor a
 * hook, and putting it in either file would mean it could only be tested
 * through one. Here it is a pure function a node-environment test can call.
 */

/** The shape every `<select>` in this app renders: `LookupOption`, structurally. */
export type RoleOption = { value: string; label: string };

/**
 * An option plus the one thing the picker has to render differently.
 *
 * `unavailable` is what makes the `<option>` `disabled`. It is a separate field
 * rather than a substring test on the label, because "the label ends in
 * (nu mai este disponibil)" is a fact about Romanian and this is a fact about
 * the archive.
 */
export type PickerRoleOption = RoleOption & { unavailable: boolean };

/**
 * `offered`, plus every entry of `carried` whose value is not already offered,
 * marked by `mark` and flagged unavailable.
 *
 * ⚠️ **THE CARRIED ENTRY IS SHOWN AND NOT SELECTABLE, AND THAT IS THE WHOLE
 * SAFETY ARGUMENT — TWO ADVERSARIAL ROUNDS ARE WHY.** The defect this fixes is
 * that a row shows a role the dropdown does not, with nothing to explain it;
 * printing the role, marked, fixes exactly that. Making it SELECTABLE would fix
 * something else and break something worse: these are CREATE screens, so the
 * next thing selected is a NEW association, and re-offering a role whose tick
 * an administrator deliberately removed would grant on a create screen the
 * eligibility that `./role-whitelists.ts` twice refuses to grant on a move —
 * "in a panel the user was not looking at". The user is told the state;
 * restoring the role is a tick in Reference Data, which is the one place that
 * can do it. The day an EXISTING association becomes editable (there is no such
 * screen today: associations are create-and-delete only), the row's own value
 * is the one case that should be selectable, and it will need its own
 * decision.
 *
 * ⚠️ **THE MARK GOES IN THE LABEL AND NEVER IN THE VALUE.** The `<option>`'s
 * value stays the bare `lookup_person_role.id` the row already holds, so
 * whatever reads it back reads an id — a disabled option still carries its
 * value in the DOM, and the edit path above would submit it unchanged.
 * Decorating the value instead would turn „no longer offered" into a 23503.
 *
 * ⚠️ **A carried role that IS offered is left alone rather than moved or
 * relabelled.** The offered list is the picker's own order and its own words;
 * this function may only append to it. Marking a role that is still ticked
 * would say the opposite of the truth.
 */
export function withCarriedRoles(
  offered: readonly RoleOption[],
  carried: readonly RoleOption[],
  mark: (label: string) => string,
): PickerRoleOption[] {
  const known = new Set(offered.map((o) => o.value));
  const rendered: PickerRoleOption[] = offered.map((o) => ({ ...o, unavailable: false }));
  for (const c of carried) {
    if (known.has(c.value)) continue;
    rendered.push({ value: c.value, label: mark(c.label), unavailable: true });
  }
  return rendered;
}
