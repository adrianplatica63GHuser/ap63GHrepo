import { NextResponse } from "next/server";
import { z } from "zod/v4";
import {
  listDocumentDocumentRoles,
  createDocumentDocumentRole,
} from "@/lib/admin/document-document-roles/queries";

const createSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
});

export async function GET() {
  try {
    const items = await listDocumentDocumentRoles();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/admin/document-document-roles", err);
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
    const row = await createDocumentDocumentRole(
      parsed.data.name,
      parsed.data.description ?? null,
    );
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/document-document-roles", err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
