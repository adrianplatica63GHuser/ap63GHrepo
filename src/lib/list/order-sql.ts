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
import { CHANGED, ORDER_PARAM, type ListOrder } from "@/lib/list/list-order";

/** The two words, whitelisted: no `sort` is `changed`, no `order` is `desc`. */
export function listOrderQuerySchema(sorts: readonly [string, ...string[]]) {
  return z.object({
    sort: z.enum(sorts as [string, ...string[]]).default(CHANGED),
    order: z.enum(["asc", "desc"]).default("desc"),
  });
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
 * The ORDER BY: the expression `order.sort` names (`changed` when none is given or it names nothing here), empty
 * values last whichever way, then the id the same way.
 */
export function listOrderBy(order: ListOrder | undefined, columns: Readonly<Record<string, SQL>>, id: AnyColumn): SQL[] {
  const o = order ?? { sort: CHANGED, order: "desc" };
  const expr = columns[o.sort] ?? columns[CHANGED];
  if (!expr) throw new Error(`listOrderBy: no expression for "${o.sort}" or "${CHANGED}"`);
  return o.order === "asc" ? [sql`${expr} asc nulls last`, asc(id)] : [sql`${expr} desc nulls last`, desc(id)];
}
