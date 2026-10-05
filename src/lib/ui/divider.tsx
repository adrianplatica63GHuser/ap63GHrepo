/**
 * The line that separates the items of a tile.                  (Slice #37.81)
 *
 * One look for every such line, the one Adrian liked under „Clasificări"'s version controls — „It doesn't touch the edges and is not too
 * obtrusive": 1 px, in the tile's rim colour (`border-card-rim`, dark
 * `zinc-700`), drawn inside the tile's padding so it never reaches the tile's
 * border. It is an element of its own, not a border on what stands above it,
 * so the space on either side is the parent's gap — the same above and below
 * (left and right).
 *
 * HORIZONTAL runs the parent's width; VERTICAL runs the height of the row it
 * stands in (`self-stretch`), so it stops short of the lines above and below
 * the row by the row's gap. Used by „Clasificări" (#37.81) and
 * „Conexiuni" (#37.82).
 */

/** The line's own classes: a 1-px border in the rim colour — the version line's. */
export const DIVIDER_LINE = "border-card-rim dark:border-zinc-700";

export const DIVIDER_HORIZONTAL = `w-full shrink-0 border-t ${DIVIDER_LINE}`;
export const DIVIDER_VERTICAL = `self-stretch shrink-0 border-l ${DIVIDER_LINE}`;

export function Divider({ vertical = false }: { vertical?: boolean }) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      data-divider={vertical ? "vertical" : "horizontal"}
      className={vertical ? DIVIDER_VERTICAL : DIVIDER_HORIZONTAL}
    />
  );
}
