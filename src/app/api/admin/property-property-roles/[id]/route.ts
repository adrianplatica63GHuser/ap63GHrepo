import { NextResponse } from "next/server";
import { z } from "zod/v4";
import {
  updatePropertyPropertyRole,
  deletePropertyPropertyRole,
} from "@/lib/admin/property-property-roles/queries";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    await updatePropertyPropertyRole(id, parsed.data.name, parsed.data.description ?? null);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("PATCH /api/admin/property-property-roles/[id]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await deletePropertyPropertyRole(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/admin/property-property-roles/[id]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
