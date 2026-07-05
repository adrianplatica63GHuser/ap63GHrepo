import { NextResponse } from "next/server";
import { z } from "zod/v4";
import {
  listPersonPersonRoles,
  createPersonPersonRole,
} from "@/lib/admin/person-person-roles/queries";

const createSchema = z.object({
  personRoleId: z.string().uuid(),
});

export async function GET() {
  try {
    const items = await listPersonPersonRoles();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/admin/person-person-roles", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const row = await createPersonPersonRole(parsed.data.personRoleId);
    return NextResponse.json(row, { status: 201 });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("lookup_person_person_role_person_role_id_unique")
    ) {
      return NextResponse.json(
        { error: "This role is already in the list" },
        { status: 409 },
      );
    }
    console.error("POST /api/admin/person-person-roles", err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
