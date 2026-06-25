import { NextResponse } from "next/server";
import { listHelpHints } from "@/lib/help/queries";

/**
 * GET /api/admin/help-hints
 *
 * Lists every help_hint row that currently has data. Consumed by the
 * Administration -> Help Content screen alongside the registry's
 * HELP_HINTS list, to show Missing/Complete badges for every registered
 * hint slot.
 */
export async function GET() {
  try {
    const items = await listHelpHints();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/admin/help-hints", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
