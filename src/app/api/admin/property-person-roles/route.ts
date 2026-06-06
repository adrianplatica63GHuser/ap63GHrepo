import { NextResponse } from "next/server";
import { z } from "zod/v4";
import {
  listPropertyPersonRoles,
  createPropertyPersonRole,
} from "@/lib/admin/property-person-roles/queries";

const createSchema = z.object({
  personRoleId: z.string().uuid(),
});

export async function GET() {
  try {
    const items = await listPropertyPersonRoles();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/admin/property-person-roles", err);
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

    const row = await createPropertyPersonRole(parsed.data.personRoleId);
    return NextResponse.json(row, { status: 201 });
  } catch (err: unknown) {
    // Unique-constraint violation → duplicate
    if (
      err instanceof Error &&
      err.message.includes("lookup_property_person_role_unique")
    ) {
      return NextResponse.json(
        { error: "This role is already in the list" },
        { status: 409 },
      );
    }
    console.error("POST /api/admin/property-person-roles", err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
