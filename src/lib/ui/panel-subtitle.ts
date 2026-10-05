/**
 * A panel's subtitle inside a Document's tile, in square brackets: „Preț și
 * taxe" shows „[Financiar]" and „[Taxe și onorarii]".          (Slice #37.90)
 *
 * Display only. The stored `groupRo` is unchanged, so the form's recognition
 * of a panel by its exact text (Financiar beside Taxe și onorarii,
 * „Certificate și referințe" full width) and the AI prompt read it as before.
 * Every panel with a subtitle gets the brackets, a tile's only panel too.
 */
export function panelSubtitle(title: string): string {
  return `[${title}]`;
}
