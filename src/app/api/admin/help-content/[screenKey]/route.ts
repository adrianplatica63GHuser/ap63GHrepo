import { NextResponse } from "next/server";
import { helpContentUpsertSchema } from "@/lib/help/validation";
import { isHelpScreenKey } from "@/lib/help/registry";
import { getHelpContent, upsertHelpContent } from "@/lib/help/queries";

/**
 * GET /api/admin/help-content/[screenKey]
 * PUT /api/admin/help-content/[screenKey]
 *
 * Single-screen read/write for the Administration -> Help Content editor.
 * PUT validates screenKey against the registry — only screens Claude has
 * registered may receive content; everything else is a 400, since a typo'd
 * key would otherwise silently create an orphaned row that no <HelpButton>
 * could ever read back.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ screenKey: string }> },
) {
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
  try {
    const { screenKey } = await params;
    if (!isHelpScreenKey(screenKey)) {
      return NextResponse.json({ error: "Unknown screen key" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = helpContentUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const row = await upsertHelpContent(screenKey, parsed.data);
    return NextResponse.json({ item: row });
  } catch (err) {
    console.error("PUT /api/admin/help-content/[screenKey]", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
