import { NextResponse } from "next/server";
import { deletePropertyPersonRole } from "@/lib/admin/property-person-roles/queries";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deletePropertyPersonRole(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/admin/property-person-roles/[id]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
