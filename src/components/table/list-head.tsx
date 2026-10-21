/**
 * One cell of a principal list's band of column names.                                  (Slices #39.83, 40.20, 40.21)
 *
 * Adrian, 2026-10-21 (Slice 40.21, replacing #39.83's three rows): „I would like the title bar to be only two rows
 * tall - not three rows like now; I would like to have horizontal centering and vertical centering of whatever the
 * content of the title is - and that includes the column name and (possibly) the filter icon".
 *
 * So every name cell of the four lists is this one component, and every one is the band's full height whatever
 * columns are chosen — the table does not jump as a funnel comes and goes:
 *   - the band is two rows of the names' line (40.18's Roboto Condensed 13.5 px on 18 px), `HEAD_BAND_PX`, inside the
 *     cell's `px-4 py-2` as before (Ask first 1);
 *   - the name and, where the column filters, its funnel after it are ONE group, centred both ways in the cell (Ask
 *     first 2, 3). A name too wide for its column wraps onto the second row, balanced (`text-balance`), never a third
 *     (`line-clamp-2`), its lines centred; the funnel stays beside the last line (`items-end`);
 *   - the funnel is drawn on the name's line: its 26-px button takes only the line's 18 px in the layout (`-my-1`, four
 *     px of the cell's padding above and below), so its pressable area stays 26 × 26 and the band no taller (Ask first
 *     2). Its active look is its own variant, unchanged (Ask first 4).
 *
 * Slice 40.20: the names are Adrian's short ones (the lists' `listHeads` keys); `full` is the field's whole label,
 * shown on hover over the short name („Data nașterii" over „Născut pe").
 *
 * `data-head-band` (filter | plain), `data-head-name` (the group), `data-head-text` and `data-head-funnel` mark the
 * parts for TC-LAYOUT-05.
 */
import type { ReactNode } from "react";
import { columnHead } from "@/components/table/fixed-columns";
import type { ColumnName } from "@/lib/ui/field-widths";

/** Two rows of the names' 18-px line (Slice 40.21; it was two text rows and the funnel's 26-px row, 62 px). */
export const HEAD_BAND_PX = 18 + 18;

export function ListHeadCell({
  column,
  name,
  full,
  funnel,
}: {
  column: ColumnName;
  name: string;
  /** The field's whole label, shown on hover over the short name (Slice 40.20). */
  full?: string;
  /** The column's funnel, when it can be filtered. */
  funnel?: ReactNode;
}) {
  return (
    <th className="px-4 py-2 align-middle" {...columnHead(column)}>
      <div className="flex items-center justify-center" style={{ height: HEAD_BAND_PX }} data-head-band={funnel ? "filter" : "plain"}>
        <span className="flex min-w-0 items-end justify-center gap-1" data-head-name="">
          <span className="line-clamp-2 min-w-0 text-balance break-words text-center" data-head-text="" title={full}>
            {name}
          </span>
          {funnel && (
            <span className="-my-1 inline-flex shrink-0" data-head-funnel="">
              {funnel}
            </span>
          )}
        </span>
      </div>
    </th>
  );
}
