/**
 * GET /api/inheritance-tree  (Slice #39.11)
 *
 * Every natural person with a family tie, and the ties — what „Rapoarte → Arbori de moștenire" draws.
 * Read only; `loadInheritanceTree` (src/lib/inheritance/queries.ts) says what it selects and why no more.
 */
import { unexpectedError } from "@/lib/api/errors";
import { loadInheritanceTree } from "@/lib/inheritance/queries";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await loadInheritanceTree());
  } catch (err) {
    return unexpectedError(err, "GET /api/inheritance-tree");
  }
}
