/**
 * One cell of a principal list's band of column names.                                  (Slices #39.83, 40.20, 40.21, 40.29, 40.30)
 *
 * Adrian, 2026-10-21 (Slice 40.21, replacing #39.83's three rows): „I would like the title bar to be only two rows
 * tall - not three rows like now; I would like to have horizontal centering and vertical centering of whatever the
 * content of the title is - and that includes the column name and (possibly) the filter icon".
 *
 * So every name cell of the four lists is this one component, and every one is the band's full height whatever
 * columns are chosen — the table does not jump as a funnel comes and goes:
 *   - the band is two rows of the names' line (40.18's Roboto Condensed 13.5 px; on 17 px since 40.30, 18 before),
 *     `HEAD_BAND_PX`, inside the cell's `px-4 py-[2.5px]` (py-2 until 40.30) — 39 px in all, ¾ of 40.21's 52;
 *   - the name ALONE is centred both ways in the cell (Ask first 2, 3). A name too wide for its column wraps onto the
 *     second row, balanced (`text-balance`), never a third (`line-clamp-2`), its lines centred;
 *   - Slice 40.29 (Adrian, 2026-10-22: „the funnel button will become 50% narrower 50% shorter … and it will move to
 *     the bottom right corner of the cell that holds the title of the column; The presence of this button will not
 *     influence the positioning of the column name which will be centred vertically and horizontally"): the funnel,
 *     13 × 13 (`FilterFunnel`, `square="corner"`), is out of the flow — absolute in the <th>'s bottom-right corner,
 *     2 px in from its right and bottom edges, inside the cell's 16-px right padding, so it never covers the name and
 *     no room is reserved for it. The <th> is its positioning box. (40.21 had the name and the funnel as ONE centred
 *     group, the funnel beside the name's last line.) Its active look is its own variant, unchanged.
 *
 * Slice 40.20: the names are Adrian's short ones (the lists' `listHeads` keys); `full` is the field's whole label,
 * shown on hover over the short name („Data nașterii" over „Născut pe").
 *
 * `data-head-band` (filter | plain), `data-head-name` (the name's box), `data-head-text` and `data-head-funnel` mark the
 * parts for TC-LAYOUT-05.
 *
 * Slice 40.25: with `drag`, the cell is the handle its column is moved by — grabbed anywhere but its funnel
 * (`src/components/list/column-order.tsx`).
 *
 * Slice 40.47: with `sort`, the column's sort icon (`ColumnSort`) in the same corner, 2 px left of the funnel — or where
 * the funnel would be, on a column that sorts and does not filter (Ask first 2) — out of the flow like it, so the name
 * never moves; `ariaSort` is the <th>'s `aria-sort`. `data-head-sort` marks it.
 */
import type { ReactNode } from "react";
import { columnHead } from "@/components/table/fixed-columns";
import type { ColumnName } from "@/lib/ui/field-widths";
import type { HeadDragProps } from "@/components/list/column-order";

/**
 * Two rows of the names' line: 17 px since Slice 40.30 (18 in 40.21; before it two text rows and the funnel's 26-px
 * row, 62 px). With the cell's 2.5-px padding above and below, the band is 39 px — three quarters of 40.21's 52
 * (Adrian, 2026-10-22: „The height of the title bar should be 3/4 of what it is now").
 */
export const HEAD_LINE_PX = 17;
export const HEAD_BAND_PX = HEAD_LINE_PX + HEAD_LINE_PX;
/** The cell's padding above and below the band (`py-[2.5px]`, Slice 40.30; it was py-2). */
export const HEAD_PAD_PX = 2.5;

export function ListHeadCell({
  column,
  name,
  full,
  funnel,
  drag,
  sort,
  ariaSort,
}: {
  column: ColumnName;
  name: string;
  /** The field's whole label, shown on hover over the short name (Slice 40.20). */
  full?: string;
  /** The column's funnel, when it can be filtered. */
  funnel?: ReactNode;
  /** Slice 40.25: the cell as the handle its column is dragged by (`useColumnDrag`). */
  drag?: HeadDragProps;
  /** Slice 40.47: the column's sort icon, when it sorts, and the <th>'s `aria-sort`. */
  sort?: ReactNode;
  ariaSort?: "ascending" | "descending" | "none";
}) {
  return (
    <th
      className={`relative px-4 py-[2.5px] align-middle${drag ? " cursor-grab select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus" : ""}`}
      {...columnHead(column)}
      {...drag}
      aria-sort={sort ? ariaSort : undefined}
    >
      <div className="flex items-center justify-center" style={{ height: HEAD_BAND_PX }} data-head-band={funnel ? "filter" : "plain"}>
        <span className="flex min-w-0 items-center justify-center" data-head-name="">
          <span className="line-clamp-2 min-w-0 text-balance break-words text-center leading-[17px]" data-head-text="" title={full}>
            {name}
          </span>
        </span>
      </div>
      {/* Slice 40.47: 2 px left of the funnel's 13 px (2 + 13 + 2 = 17 px from the edge), or in its place. Drawn
          BEFORE the funnel, so the funnel's 20-px pressable area, which reaches 5 px left over the gap, stays on top. */}
      {sort && (
        <span className={`absolute bottom-0.5 ${funnel ? "right-[17px]" : "right-0.5"} inline-flex`} data-head-sort="">
          {sort}
        </span>
      )}
      {funnel && (
        <span className="absolute bottom-0.5 right-0.5 inline-flex" data-head-funnel="">
          {funnel}
        </span>
      )}
    </th>
  );
}
