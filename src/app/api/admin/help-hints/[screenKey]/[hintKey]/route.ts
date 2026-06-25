import { NextResponse } from "next/server";
import { helpHintUpsertSchema } from "@/lib/help/validation";
import { isHelpHint } from "@/lib/help/registry";
import { getHelpHint, upsertHelpHint } from "@/lib/help/queries";

/**
 * GET /api/admin/help-hints/[screenKey]/[hintKey]
 * PUT /api/admin/help-hints/[screenKey]/[hintKey]
 *
 * Single-hint read/write for the Administration -> Help Content editor.
 * PUT validates the (screenKey, hintKey) pair against the registry — see
 * the equivalent note on the help-content route.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ screenKey: string; hintKey: string }> },
) {
  try {
    const { screenKey, hintKey } = await params;
    const row = await getHelpHint(screenKey, hintKey);
    return NextResponse.json({ item: row });
  } catch (err) {
    console.error("GET /api/admin/help-hints/[screenKey]/[hintKey]", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ screenKey: string; hintKey: string }> },
) {
  try {
    const { screenKey, hintKey } = await params;
    if (!isHelpHint(screenKey, hintKey)) {
      return NextResponse.json({ error: "Unknown screen/hint key" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = helpHintUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const row = await upsertHelpHint(screenKey, hintKey, parsed.data);
    return NextResponse.json({ item: row });
  } catch (err) {
    console.error("PUT /api/admin/help-hints/[screenKey]/[hintKey]", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
