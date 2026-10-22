/**
 * One cell of a principal list's band of column names.                                  (Slices #39.83, 40.20, 40.21, 40.29)
 *
 * Adrian, 2026-10-21 (Slice 40.21, replacing #39.83's three rows): „I would like the title bar to be only two rows
 * tall - not three rows like now; I would like to have horizontal centering and vertical centering of whatever the
 * content of the title is - and that includes the column name and (possibly) the filter icon".
 *
 * So every name cell of the four lists is this one component, and every one is the band's full height whatever
 * columns are chosen — the table does not jump as a funnel comes and goes:
 *   - the band is two rows of the names' line (40.18's Roboto Condensed 13.5 px on 18 px), `HEAD_BAND_PX`, inside the
 *     cell's `px-4 py-2` as before (Ask first 1);
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
 */
import type { ReactNode } from "react";
import { columnHead } from "@/components/table/fixed-columns";
import type { ColumnName } from "@/lib/ui/field-widths";
import type { HeadDragProps } from "@/components/list/column-order";

/** Two rows of the names' 18-px line (Slice 40.21; it was two text rows and the funnel's 26-px row, 62 px). */
export const HEAD_BAND_PX = 18 + 18;

export function ListHeadCell({
  column,
  name,
  full,
  funnel,
  drag,
}: {
  column: ColumnName;
  name: string;
  /** The field's whole label, shown on hover over the short name (Slice 40.20). */
  full?: string;
  /** The column's funnel, when it can be filtered. */
  funnel?: ReactNode;
  /** Slice 40.25: the cell as the handle its column is dragged by (`useColumnDrag`). */
  drag?: HeadDragProps;
}) {
  return (
    <th
      className={`relative px-4 py-2 align-middle${drag ? " cursor-grab select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus" : ""}`}
      {...columnHead(column)}
      {...drag}
    >
      <div className="flex items-center justify-center" style={{ height: HEAD_BAND_PX }} data-head-band={funnel ? "filter" : "plain"}>
        <span className="flex min-w-0 items-center justify-center" data-head-name="">
          <span className="line-clamp-2 min-w-0 text-balance break-words text-center" data-head-text="" title={full}>
            {name}
          </span>
        </span>
      </div>
      {funnel && (
        <span className="absolute bottom-0.5 right-0.5 inline-flex" data-head-funnel="">
          {funnel}
        </span>
      )}
    </th>
  );
}
