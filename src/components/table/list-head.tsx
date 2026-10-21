/**
 * One cell of a principal list's band of column names.                                             (Slice #39.83)
 *
 * Adrian, 2026-10-18: „the bar with the column names in every principal object list will have a height of three
 * rows The third row will have the funnel icon for filter and nothing else for the columns that can take a filter;
 * the first and second row we'll have the name of the column If the column name takes two rows; if the column takes
 * one Then it will be on the second row; The column names that have no filters (nickname) will be centred on the
 * vertical within this bar".
 *
 * So every name cell of the four lists is this one component (#39.83's „one shared header cell rather than four
 * copies"), and every one is the band's full height, whatever columns are chosen — the table does not jump as a
 * funnel comes and goes (Ask first 3):
 *   - with a filter: the name on rows 1–2, bottom-aligned (a one-line name sits on row 2), the funnel alone on row 3;
 *   - without one — Poreclă, Cod, the name or title, any column that does not filter (Ask first 4): the name centred
 *     vertically in the band.
 * A name never takes more than two rows: Adrian's long names always break, where the two rows come out most even
 * (`splitName`); any other wraps only when its column is narrower than it, balanced by the browser.
 *
 * The rows: two text rows of the header's 18-px line, then the funnel's own — an xs button, 26 px. The band is
 * `HEAD_BAND_PX` tall inside the cell's padding. Slice 40.18: the names are Roboto Condensed 13.5 px on an 18-px line
 * (alternative 13), so the text rows went from 16 to 18 px and the band from 58 to 62 — `LIST_HEAD_PX`, the frame's
 * floor and the red signs follow.
 */
import type { ReactNode } from "react";
import { columnHead } from "@/components/table/fixed-columns";
import type { ColumnName } from "@/lib/ui/field-widths";
import { splitName } from "@/lib/ui/list-head";

/** Two 18-px text rows and the funnel's 26-px row. */
export const HEAD_BAND_PX = 18 + 18 + 26;

export function ListHeadCell({
  column,
  name,
  twoRows = false,
  funnel,
}: {
  column: ColumnName;
  name: string;
  /** One of Adrian's long names: always on two rows, broken where they come out most even. */
  twoRows?: boolean;
  /** The column's funnel, when it can be filtered. */
  funnel?: ReactNode;
}) {
  const split = twoRows ? splitName(name) : null;
  const text = (
    <span className="line-clamp-2 text-balance break-words" data-head-text="">
      {split ? (
        <>
          {/* The space keeps the name's words apart in its text — what a screen reader and a search read. */}
          {split[0]}{" "}
          <br />
          {split[1]}
        </>
      ) : (
        name
      )}
    </span>
  );
  return (
    <th className="px-4 py-2 align-top" {...columnHead(column)}>
      <div className="grid grid-rows-[1.125rem_1.125rem_1.625rem]" style={{ height: HEAD_BAND_PX }} data-head-band={funnel ? "filter" : "plain"}>
        {funnel ? (
          <>
            <span className="row-span-2 flex min-w-0 items-end" data-head-name="">
              {text}
            </span>
            <span className="row-start-3 flex items-end" data-head-funnel="">
              {funnel}
            </span>
          </>
        ) : (
          <span className="row-span-3 flex min-w-0 items-center" data-head-name="">
            {text}
          </span>
        )}
      </div>
    </th>
  );
}
