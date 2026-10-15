/**
 * GET /api/account/skills-progress                                                           (Slice #39.41)
 *
 * The signed-in user's progress through the skills: each skill's state (closed / open / mastered / obsolete),
 * whether its quiz can be taken now, and — after a failed quiz — when it opens again; and each Path's mastery.
 * The skills diagram (#39.42) and the quiz page (#39.43) read it.
 *
 *   { skills: [{ key, state, quizAvailable, retryAt: ISO | null, attempts, masteredAt: ISO | null }], paths: { <path>: boolean } }
 *
 * The user is the session's, never a parameter — the same as /api/account/tile-defaults. Read-only: an attempt
 * is written only by recordAttempt() on the server (src/lib/skills/attempts.ts), never by a route the browser
 * can post a score to.
 */
import { getCurrentUser } from "@/lib/auth/current-user";
import { unexpectedError } from "@/lib/api/errors";
import { getProgress } from "@/lib/skills/attempts";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const progress = await getProgress(user.id);
    return Response.json({
      skills: progress.skills.map((s) => ({
        ...s,
        retryAt: s.retryAt ? s.retryAt.toISOString() : null,
        masteredAt: s.masteredAt ? s.masteredAt.toISOString() : null,
      })),
      paths: progress.paths,
    });
  } catch (err) {
    return unexpectedError(err, "GET /api/account/skills-progress");
  }
}
