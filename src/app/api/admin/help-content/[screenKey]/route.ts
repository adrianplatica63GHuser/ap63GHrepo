import { requireFullAccess } from "@/lib/auth/current-role";
import { NextResponse } from "next/server";
import { helpContentUpsertSchema } from "@/lib/help/validation";
import { isHelpScreenKey } from "@/lib/help/registry";
import { getHelpContent, upsertHelpContent } from "@/lib/help/queries";
import { helpFingerprint } from "@/lib/help/proposals";
import { HELP_SAVE_CODE } from "@/lib/help/save-failure";

/**
 * GET /api/admin/help-content/[screenKey]
 * PUT /api/admin/help-content/[screenKey]
 *
 * Single-screen read/write for the Administration -> Help Content editor.
 * PUT validates screenKey against the registry — only screens Claude has
 * registered may receive content; everything else is a 400, since a typo'd
 * key would otherwise silently create an orphaned row that no <HelpButton>
 * could ever read back.
 *
 * Slice 40.15: every refusal carries a `code` beside its `error`, which the editor turns into a sentence that says
 * why (`src/lib/help/save-failure.ts`) — the screen never shows the raw text. A proposal's „Acceptă" sends `against`,
 * the fingerprint of the text it was written against; when the screen's text is another one now the PUT is refused
 * with 409 `text_changed` and nothing is overwritten. The editor's own „Salvează" sends none, and saves.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ screenKey: string }> },
) {
  // Full access only (superuser-only until #38.21) — FU-002, Slice #36.20 (src/lib/auth/current-role.ts).
  const denied = await requireFullAccess();
  if (denied) return denied;

  try {
    const { screenKey } = await params;
    const row = await getHelpContent(screenKey);
    return NextResponse.json({ item: row });
  } catch (err) {
    console.error("GET /api/admin/help-content/[screenKey]", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ screenKey: string }> },
) {
  // Full access only (superuser-only until #38.21) — FU-002, Slice #36.20 (src/lib/auth/current-role.ts).
  const denied = await requireFullAccess();
  if (denied) return denied;

  try {
    const { screenKey } = await params;
    if (!isHelpScreenKey(screenKey)) {
      return NextResponse.json({ error: "Unknown screen key", code: HELP_SAVE_CODE.unknownScreen }, { status: 400 });
    }

    const body = await req.json().catch(() => undefined);
    const parsed = helpContentUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", code: HELP_SAVE_CODE.invalid }, { status: 400 });
    }

    const { against, ...texts } = parsed.data;
    if (against !== undefined && helpFingerprint(await getHelpContent(screenKey)) !== against) {
      return NextResponse.json({ error: "The screen's text changed since the proposal was written", code: HELP_SAVE_CODE.textChanged }, { status: 409 });
    }

    const row = await upsertHelpContent(screenKey, texts);
    return NextResponse.json({ item: row });
  } catch (err) {
    console.error("PUT /api/admin/help-content/[screenKey]", err);
    return NextResponse.json({ error: "Failed to save", code: HELP_SAVE_CODE.database }, { status: 500 });
  }
}
