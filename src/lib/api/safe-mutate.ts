/**
 * safeMutate — shared fetch wrapper for all mutating API calls.
 *
 * Handles the two failure modes that bare `fetch` misses:
 *
 *  1. **Expired session redirect** — the auth middleware redirects a PATCH/POST
 *     to /sign-in; fetch follows it silently and returns a 200 (the sign-in
 *     HTML), making the save *appear* successful while the change is lost.
 *     `res.redirected` catches this and throws a user-visible i18n error.
 *
 *  2. **Non-OK HTTP status** — reads the JSON error body if available and
 *     throws a descriptive error string.
 *
 * On success the raw `Response` is returned so callers can read the body
 * (e.g. to get a newly-created entity's id).
 *
 * `t` is the caller's own next-intl translator — the keys `saveErrorSession`
 * and `saveError` must exist in that namespace (all four form namespaces
 * already have them).
 */
export async function safeMutate(
  url: string,
  options: RequestInit,
  t: (key: string) => string,
): Promise<Response> {
  const res = await fetch(url, options);

  // An expired session is redirected to /sign-in by the auth middleware;
  // fetch follows that as a 200 (the sign-in HTML), which would otherwise
  // look like a successful save and silently lose the change.
  if (res.redirected) {
    throw new Error(t("saveErrorSession"));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `${t("saveError")} (HTTP ${res.status})`);
  }

  return res;
}
