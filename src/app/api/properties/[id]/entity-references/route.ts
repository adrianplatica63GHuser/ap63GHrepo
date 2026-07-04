import { NextResponse } from "next/server";
import { listEntityGroupTags } from "@/lib/groups/queries";
import { listEntityStampTags } from "@/lib/stamps/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [entityGroups, entityStamps] = await Promise.all([
    listEntityGroupTags({ propertyId: id }),
    listEntityStampTags({ propertyId: id }),
  ]);
  return NextResponse.json({ groups: entityGroups, stamps: entityStamps });
}
