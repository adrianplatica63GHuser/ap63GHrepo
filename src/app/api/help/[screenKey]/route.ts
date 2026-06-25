import { NextResponse } from "next/server";
import { getHelpContent, listHelpHints } from "@/lib/help/queries";

/**
 * GET /api/help/[screenKey]
 *
 * Read-only endpoint consumed by <HelpButton> and <HelpHint> on every
 * authenticated screen. Returns the Background/How-To content for this
 * screen (or null if nothing has been written yet) plus every hint row
 * scoped to this screen — <HelpHint> picks its own hintKey out of the list,
 * so a screen with multiple hints only needs one fetch.
 *
 * Deliberately does not validate screenKey against the registry — an
 * unregistered or misspelled key simply yields { content: null, hints: [] },
 * which both components treat as "nothing to show."
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ screenKey: string }> },
) {
  try {
    const { screenKey } = await params;
    const [content, allHints] = await Promise.all([
      getHelpContent(screenKey),
      listHelpHints(),
    ]);
    const hints = allHints.filter((h) => h.screenKey === screenKey);
    return NextResponse.json({ content, hints });
  } catch (err) {
    console.error("GET /api/help/[screenKey]", err);
    return NextResponse.json({ error: "Failed to load help content" }, { status: 500 });
  }
}
