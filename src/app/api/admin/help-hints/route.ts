import { requireSuperuser } from "@/lib/auth/current-role";
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
  // Superuser only — FU-002, Slice #36.20 (src/lib/auth/current-role.ts).
  const denied = await requireSuperuser();
  if (denied) return denied;

  try {
    const items = await listHelpHints();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/admin/help-hints", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
