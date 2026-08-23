import { NextResponse } from "next/server";
import { pgErrorCode } from "@/lib/api/errors";
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
    // Unique-constraint violation → duplicate.
    // Slice #29.13: SQLSTATE rather than the constraint name — see the
    // doc-type-person-roles route for the name that does not exist in every
    // environment, and why this branch is now load-bearing.
    if (pgErrorCode(err) === "23505") {
      // Slice #29.13: `code` so the panel can say this in Romanian. See the
      // doc-type-person-roles route for why a bare 409 was not enough.
      return NextResponse.json(
        { error: "This role is already in the list", code: "DUPLICATE" },
        { status: 409 },
      );
    }
    console.error("POST /api/admin/property-person-roles", err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
