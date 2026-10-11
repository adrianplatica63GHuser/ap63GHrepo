/**
 * GET /api/interactions/export?…                                   (Slice #38.88)
 *
 * The rows the history's filters show, in its order, without paging, as a CSV Excel opens with the Romanian letters
 * intact (`src/lib/interactions/export.ts`). The query is the list's own, minus the page, plus `tz` — the browser's
 * time zone, so the dates read as the grid shows them. The description is in the file; the internal note is not.
 */
import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod/v4";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { exportInteractions } from "@/lib/interactions/queries";
import { interactionListQuerySchema } from "@/lib/interactions/validation";
import { EXPORT_COLUMNS, exportFileName, toCsv, type ExportWords } from "@/lib/interactions/export";
import { INTERACTION_CHANNELS, INTERACTION_DIRECTIONS, INTERACTION_STATUSES } from "@/lib/interactions/model";

const exportQuerySchema = interactionListQuerySchema
  .omit({ limit: true, offset: true })
  .extend({ tz: z.string().min(1).max(64).optional() })
  .strict();

export async function GET(request: NextRequest): Promise<Response> {
  const parsed = exportQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  const { tz, ...query } = parsed.data;
  try {
    const rows = await exportInteractions(query);
    const t = await getTranslations("interactions");
    const tu = await getTranslations("shared.unnamed");
    const words: ExportWords = {
      column: Object.fromEntries(EXPORT_COLUMNS.map((c) => [c, t(`export.column.${c}`)])) as ExportWords["column"],
      channel: Object.fromEntries(INTERACTION_CHANNELS.map((c) => [c, t(`channel.${c}`)])) as ExportWords["channel"],
      direction: Object.fromEntries(INTERACTION_DIRECTIONS.map((d) => [d, t(`direction.${d}`)])) as ExportWords["direction"],
      status: Object.fromEntries(INTERACTION_STATUSES.map((s) => [s, t(`status.${s}`)])) as ExportWords["status"],
      unnamedPerson: tu("person"),
    };
    return new Response(toCsv(rows, words, tz), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(new Date(), tz)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return unexpectedError(err, "GET /api/interactions/export");
  }
}
