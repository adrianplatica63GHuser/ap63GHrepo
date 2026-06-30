/**
 * Properties-Map "Groups" filter predicate  (Slice #18.08 + #18.17)
 *
 * Pure (no DB / React) so it can be unit-tested in isolation.
 *
 * The map's Groups panel lets the user uncheck items. A property is
 * VISIBLE when it matches at least one checked item:
 *   - Items with NO group are visible unless the "_ungrouped" sentinel is
 *     present in uncheckedCodes (Slice #18.17: "Not in a group" checkbox).
 *   - Items WITH groups are hidden only when EVERY one of their groups has
 *     been unchecked.
 *
 * @param groupCodes      the property's PROPERTY-group codes (may be empty)
 * @param uncheckedCodes  the set of items the user has unchecked; may include
 *                        the sentinel "_ungrouped" to hide ungrouped properties
 */
export function isPropertyVisibleForGroups(
  groupCodes: readonly string[],
  uncheckedCodes: ReadonlySet<string>,
): boolean {
  if (groupCodes.length === 0) return !uncheckedCodes.has("_ungrouped");
  return groupCodes.some((code) => !uncheckedCodes.has(code));
}
