/**
 * A principal list's order, on the server.                                                               (Slice 40.46)
 *
 * The route reads `sort` and `order` against the list's whitelist (`LIST_SORTS`) and refuses anything else as it
 * refuses any other bad parameter — a zod error, 400 (Ask first 1). The query orders by the expression named, then by
 * the row's id in the same direction, so two records touched in the same instant never swap places between pages.
 * The model is `list-order.ts`.
 */
import { asc, desc, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { z } from "zod/v4";
import { CHANGED, ORDER_PARAM, firstDirection, type ListOrder } from "@/lib/list/list-order";

/** The two words, whitelisted: no `sort` is `changed`, no `order` is the sort's first direction (40.47). */
export function listOrderQuerySchema(sorts: readonly [string, ...string[]]) {
  return z
    .object({
      sort: z.enum(sorts as [string, ...string[]]).default(CHANGED),
      order: z.enum(["asc", "desc"]).optional(),
    })
    .transform((v): ListOrder => ({ sort: v.sort, order: v.order ?? firstDirection(v.sort) }));
}

/** A route's order, read from its query string. */
export function parseListOrderQuery(params: URLSearchParams, sorts: readonly [string, ...string[]]) {
  return listOrderQuerySchema(sorts).safeParse({
    sort: params.get(ORDER_PARAM.sort) ?? undefined,
    order: params.get(ORDER_PARAM.order) ?? undefined,
  });
}

/** The record added or changed last: what `changed` orders by, on any of the four tables. */
export function changedAt(updatedAt: AnyColumn, createdAt: AnyColumn): SQL {
  return sql`greatest(${updatedAt}, ${createdAt})`;
}

/**
 * Text in natural order (40.47, Ask first 4): „2" before „10", „12/2" before „12/3" before „12/10" — two keys, the
 * runs of digits as a number array, then the text folded. A text with no digit sorts before every number („{}"); an
 * empty one is NULL, so last whichever way.
 */
export function naturalOrder(expr: SQL): SQL[] {
  return [
    sql`(case when nullif(btrim(${expr}), '') is null then null when ${expr} ~ '[0-9]' then regexp_split_to_array(btrim(regexp_replace(${expr}, '[^0-9]+', ' ', 'g')), ' ')::numeric[] else '{}'::numeric[] end)`,
    sql`lower(nullif(btrim(${expr}), ''))`,
  ];
}

/**
 * The ORDER BY: the expression (or the keys) `order.sort` names (`changed` when none is given or it names nothing
 * here), empty values last whichever way, then the id the same way — so the order is total and never swaps rows
 * between pages.
 */
export function listOrderBy(order: ListOrder | undefined, columns: Readonly<Record<string, SQL | readonly SQL[]>>, id: AnyColumn): SQL[] {
  const o = order ?? { sort: CHANGED, order: "desc" };
  const named = columns[o.sort] ?? columns[CHANGED];
  if (!named) throw new Error(`listOrderBy: no expression for "${o.sort}" or "${CHANGED}"`);
  const keys: readonly SQL[] = Array.isArray(named) ? named : [named as SQL];
  return o.order === "asc"
    ? [...keys.map((k) => sql`${k} asc nulls last`), asc(id)]
    : [...keys.map((k) => sql`${k} desc nulls last`), desc(id)];
}
