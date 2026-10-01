/**
 * GrowingText's pure rules, in a module of their own.           (Slice #37.40)
 *
 * GrowingText reads its link's words through next-intl since #37.40, and a
 * test that only wants these two functions should not have to load that
 * library's ESM build. GrowingText re-exports both, so callers are unchanged.
 */

/** Every run of whitespace that holds a line break becomes one space. */
export function oneLine(value: string): string {
  return value.replace(/[^\S\r\n]*[\r\n]+[^\S\r\n]*/g, " ");
}

/**
 * How many lines the box's content takes on the screen: its full content
 * height less its padding, over its line height. jsdom has no layout, so the
 * fold's test stubs these three numbers.
 */
export function renderedLines(scrollHeight: number, paddingY: number, lineHeight: number): number {
  if (!(lineHeight > 0)) return 0;
  return Math.round(Math.max(0, scrollHeight - paddingY) / lineHeight);
}
