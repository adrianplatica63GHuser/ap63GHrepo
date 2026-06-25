import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { helpContent, helpHint } from "@/db/schema";
import type { HelpContentUpsertInput, HelpHintUpsertInput } from "./validation";

export type HelpContentRow = typeof helpContent.$inferSelect;
export type HelpHintRow = typeof helpHint.$inferSelect;

// ---------------------------------------------------------------------------
// help_content
// ---------------------------------------------------------------------------

export async function listHelpContent(): Promise<HelpContentRow[]> {
  return db.select().from(helpContent).orderBy(helpContent.screenKey);
}

export async function getHelpContent(screenKey: string): Promise<HelpContentRow | null> {
  const rows = await db
    .select()
    .from(helpContent)
    .where(eq(helpContent.screenKey, screenKey))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Update-if-exists-else-insert, keyed by screenKey (which is UNIQUE).
 * Used by the Admin -> Help Content screen — Adrian edits in place, there is
 * no separate "create" step from his point of view.
 */
export async function upsertHelpContent(
  screenKey: string,
  data: HelpContentUpsertInput,
): Promise<HelpContentRow> {
  const existing = await getHelpContent(screenKey);

  if (existing) {
    const [updated] = await db
      .update(helpContent)
      .set({
        backgroundEn: data.backgroundEn ?? null,
        backgroundRo: data.backgroundRo ?? null,
        howToEn: data.howToEn ?? null,
        howToRo: data.howToRo ?? null,
      })
      .where(eq(helpContent.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(helpContent)
    .values({
      screenKey,
      backgroundEn: data.backgroundEn ?? null,
      backgroundRo: data.backgroundRo ?? null,
      howToEn: data.howToEn ?? null,
      howToRo: data.howToRo ?? null,
    })
    .returning();
  return created;
}

// ---------------------------------------------------------------------------
// help_hint
// ---------------------------------------------------------------------------

export async function listHelpHints(): Promise<HelpHintRow[]> {
  return db.select().from(helpHint).orderBy(helpHint.screenKey, helpHint.hintKey);
}

export async function getHelpHint(
  screenKey: string,
  hintKey: string,
): Promise<HelpHintRow | null> {
  const rows = await db
    .select()
    .from(helpHint)
    .where(and(eq(helpHint.screenKey, screenKey), eq(helpHint.hintKey, hintKey)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertHelpHint(
  screenKey: string,
  hintKey: string,
  data: HelpHintUpsertInput,
): Promise<HelpHintRow> {
  const existing = await getHelpHint(screenKey, hintKey);

  if (existing) {
    const [updated] = await db
      .update(helpHint)
      .set({
        textEn: data.textEn ?? null,
        textRo: data.textRo ?? null,
      })
      .where(eq(helpHint.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(helpHint)
    .values({
      screenKey,
      hintKey,
      textEn: data.textEn ?? null,
      textRo: data.textRo ?? null,
    })
    .returning();
  return created;
}
