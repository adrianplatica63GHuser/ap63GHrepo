/**
 * Properties-Map "Groups" filter predicate  (Slice #18.08)
 *
 * Pure (no DB / React) so it can be unit-tested in isolation.
 *
 * The map's Groups panel lets the user uncheck group codes. A property is
 * VISIBLE when AT LEAST ONE of its groups is still checked; it is HIDDEN only
 * when EVERY group it belongs to has been unchecked. This covers both the
 * single-group case (uncheck its one group → hidden) and the multi-group case
 * (hidden only once all of its groups are unchecked).
 *
 * Properties that belong to NO group are always visible — the filter never
 * removes them (per the Slice #18.08 spec decision).
 *
 * @param groupCodes      the property's PROPERTY-group codes (may be empty)
 * @param uncheckedCodes  the set of group codes the user has unchecked
 */
export function isPropertyVisibleForGroups(
  groupCodes: readonly string[],
  uncheckedCodes: ReadonlySet<string>,
): boolean {
  if (groupCodes.length === 0) return true;
  return groupCodes.some((code) => !uncheckedCodes.has(code));
}
