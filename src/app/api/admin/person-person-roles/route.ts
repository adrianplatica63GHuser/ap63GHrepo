import { NextResponse } from "next/server";
import { pgErrorCode } from "@/lib/api/errors";
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
    // Unique-constraint violation → duplicate.
    // Slice #29.13: SQLSTATE rather than the constraint name. The name matched
    // here — `lookup_person_person_role_person_role_id_unique` — is one
    // Postgres never generates: migration_055 declares the column UNIQUE
    // inline, which it names `..._key`. So this branch had never once fired.
    if (pgErrorCode(err) === "23505") {
      // Slice #29.13: `code` so the panel can say this in Romanian. See the
      // doc-type-person-roles route for why a bare 409 was not enough.
      return NextResponse.json(
        { error: "This role is already in the list", code: "DUPLICATE" },
        { status: 409 },
      );
    }
    console.error("POST /api/admin/person-person-roles", err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
