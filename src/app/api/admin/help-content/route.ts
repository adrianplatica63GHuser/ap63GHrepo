import { NextResponse } from "next/server";
import { listHelpContent } from "@/lib/help/queries";

/**
 * GET /api/admin/help-content
 *
 * Lists every help_content row that currently has data. Consumed by the
 * Administration -> Help Content screen, which merges this against the
 * code-side registry (src/lib/help/registry.ts) to show Missing/Complete
 * badges for every registered screen — including ones with no row here yet.
 */
export async function GET() {
  try {
    const items = await listHelpContent();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/admin/help-content", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
