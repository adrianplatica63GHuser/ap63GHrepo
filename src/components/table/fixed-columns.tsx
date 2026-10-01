/**
 * Tables at fixed column widths.                              (Slice #37.16)
 *
 * The rule is #37.12's, for tables: THE WINDOW DECIDES HOW MANY COLUMNS ARE
 * VISIBLE BEFORE THE TABLE SCROLLS SIDEWAYS, NEVER HOW WIDE A COLUMN IS. A table
 * that uses these is `table-fixed`, its `<colgroup>` comes from `COLUMN` in
 * `src/lib/ui/field-widths.ts`, and it is exactly as wide as the columns it
 * shows — so ticking one more column in „Câmpuri afișate" makes the table wider
 * instead of squeezing the rest. Its frame is `w-fit max-w-full
 * overflow-x-auto`: as wide as the table, scrolling when the window is not.
 *
 * Every header cell spreads `columnHead(name)`, which marks it for
 * `expectStableColumns` (`e2e/helpers/field-widths.ts`). A cell in a `wraps`
 * column carries `WRAPS` so a long name breaks inside its width.
 */
import { COLUMN, columnStyle, columnsStyle, fillColumnRem, rem, tileTableRem, type ColumnName } from "@/lib/ui/field-widths";

/** The `<colgroup>`: one `<col>` per column shown, in order. */
export function FixedColumns({ columns, fill }: { columns: readonly ColumnName[]; fill?: TileFill }) {
  return (
    <colgroup>
      {columns.map((name, i) => (
        <col
          key={`${name}-${i}`}
          style={fill && name === fill.column ? { width: rem(fillColumnRem(columns, fill.units, fill.column)) } : columnStyle(name)}
        />
      ))}
    </colgroup>
  );
}

/**
 * A table that fills a unit tile (Slice #37.34): `units` wide inside its frame,
 * `column` — a `wraps` column — taking what the others leave.
 */
export type TileFill = { units: number; column: ColumnName };

/** The `<table>`'s own props: fixed layout, exactly as wide as `columns`. */
export function fixedTable(columns: readonly ColumnName[], className = "text-sm", fill?: TileFill) {
  return {
    className: `table-fixed ${className}`,
    style: fill ? { width: rem(tileTableRem(fill.units)) } : columnsStyle(columns),
    "data-width-table": columns.join(" "),
  };
}

/** A header cell's marks, for the e2e width check. */
export function columnHead(name: ColumnName) {
  return { "data-width-column": name, "data-width-kind": COLUMN[name].kind };
}

/** The frame around a fixed table: as wide as the table, scrolling sideways past the window. */
export const TABLE_FRAME = "w-fit max-w-full overflow-x-auto";

/** A cell in a `wraps` column: a long word breaks inside the column. */
export const WRAPS = "break-words";

/** `WRAPS` for a column whose kind is `wraps`, nothing for a fixed one. */
export function wrapsIf(name: ColumnName): string {
  return COLUMN[name].kind === "wraps" ? WRAPS : "";
}
