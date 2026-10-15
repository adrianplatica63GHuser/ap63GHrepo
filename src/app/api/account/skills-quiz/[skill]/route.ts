/**
 * POST /api/account/skills-quiz/<skill> — hand in a quiz.                                       (Slice #39.43)
 *
 *   { variant, answers: { <question id>: <option id> | null }, startedAt: ISO, lang: "ro" | "en" }
 *
 * The browser sends only which option it chose for each question. The server marks them against the quiz file
 * (src/lib/skills/quiz.ts → scoreQuiz), and records the attempt through 39.41's recordAttempt, which decides the
 * pass and refuses an attempt the rules do not allow. The answer:
 *
 *   passed → { passed: true, correct, total, explanations: [{ question, text, explanation, answer, section }] }
 *   failed → { passed: false, correct, total, pass, readAgain: [section links], retryAt: ISO }
 *   refused → 409 { code, retryAt? }
 *
 * After a failure the right answers are NOT sent (Ask first 3): they would carry into the next attempt. The
 * user is the session's, never a parameter.
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth/current-user";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { skillByKey } from "@/lib/skills/catalogue";
import { recordAttempt } from "@/lib/skills/attempts";
import { passMark, skillProgress } from "@/lib/skills/progress";
import { scoreQuiz } from "@/lib/skills/quiz";
import { quizFor, sectionLinks } from "@/lib/skills/quiz-server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  variant: z.string().regex(/^[a-z0-9-]{1,40}$/),
  answers: z.record(z.string().max(20), z.string().max(20).nullable()),
  startedAt: z.iso.datetime(),
  lang: z.enum(["ro", "en"]),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ skill: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { skill: raw } = await params;
    const key = decodeURIComponent(raw);
    const quiz = skillByKey(key) ? quizFor(key) : undefined;
    if (!quiz) return Response.json({ error: "No quiz for this skill", code: "no-quiz" }, { status: 404 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return zodErrorToResponse(parsed.error);
    const { variant: variantId, answers, startedAt, lang } = parsed.data;
    const variant = quiz.variants.find((v) => v.id === variantId);
    if (!variant) return Response.json({ error: "No such variant", code: "invalid" }, { status: 400 });

    const scored = scoreQuiz(variant, answers, lang);
    const r = await recordAttempt(user.id, { skillKey: key, quizVariant: variant.id, items: scored.items, startedAt: new Date(startedAt) });
    if (!r.ok) {
      return Response.json(
        { error: "The quiz cannot be taken now", code: r.code, retryAt: r.code === "cooling-down" ? r.retryAt.toISOString() : null },
        { status: r.code === "invalid" ? 400 : 409 },
      );
    }
    const locale = lang === "en" ? "en-GB" : "ro-RO";
    if (r.passed) {
      return Response.json({
        passed: true,
        correct: r.correctCount,
        total: r.questionCount,
        explanations: scored.explanations.map((e) => ({ ...e, section: sectionLinks([e.section], locale)[0] ?? null })),
      });
    }
    const retryAt = skillProgress(r.progress, key)?.retryAt ?? null;
    return Response.json({
      passed: false,
      correct: r.correctCount,
      total: r.questionCount,
      pass: passMark(r.questionCount),
      readAgain: sectionLinks(scored.readAgain, locale),
      retryAt: retryAt ? retryAt.toISOString() : null,
    });
  } catch (err) {
    return unexpectedError(err, "POST /api/account/skills-quiz/[skill]");
  }
}
