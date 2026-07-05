import { NextResponse } from "next/server";
import { deletePersonPersonRole } from "@/lib/admin/person-person-roles/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await deletePersonPersonRole(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/admin/person-person-roles/[id]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
