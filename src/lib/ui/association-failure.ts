/**
 * What an association screen shows when its POST comes back not-ok.
 *                                                              (Slice #34.15)
 *
 * All eight association screens had the same three lines —
 * `const body = await res.json().catch(() => ({}));` then
 * `throw new Error(body?.error ?? \`HTTP ${res.status}\`)` — which renders the
 * route's own `error` string verbatim. That was fine while every reachable
 * failure was a 500 nobody was meant to read. Slice #34.15 gave those routes a
 * 400 a user CAN reach, and its `error` is English by design
 * (`lib/api/errors.ts` says why: it is written for a hand-made request).
 *
 * ⚠️ **THE REACHABLE CASE IS A STALE LIST, NOT DEVTOOLS.** Nothing invalidates
 * one browser's role list when an administrator unticks a role in another. A
 * screen left open goes on offering the role it loaded; submitting then is a
 * 400. It is the same race the AI party linker answers with
 * `document.aiPartyLinker.roleMissingBody`, and these screens need their own
 * sentence for it rather than the English one.
 *
 * ⚠️ **MATCHED ON `code`, NEVER ON THE PROSE.** `pgErrorConstraint`'s header
 * makes the same point about `includes` on a constraint name: matching a
 * message is how you recognise something you did not mean. The `error` string
 * is free to be reworded; `ROLE_NOT_OFFERED` is the contract.
 *
 * Pure, and deliberately takes the already-translated sentence rather than a
 * translator: it is called from a client component's async handler, where
 * `useTranslations` cannot be called, and keeping i18n out of it is what lets
 * it be a plain function rather than a hook.
 */
export function associationFailureMessage(
  body: unknown,
  status: number,
  roleNotOffered: string,
): string {
  const parsed = body as { error?: unknown; code?: unknown } | null | undefined;
  if (parsed?.code === "ROLE_NOT_OFFERED") return roleNotOffered;
  // Unchanged from what these screens did before: the route's own sentence,
  // falling back to the status when a body could not be read at all.
  return typeof parsed?.error === "string" ? parsed.error : `HTTP ${status}`;
}
