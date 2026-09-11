/**
 * src/test-support/server-error-log.ts — the expected `unexpectedError` log.
 *                                                              (Slice #34.20)
 *
 * `unexpectedError` (src/lib/api/errors.ts) is the catch-all most routes end
 * in — 62 of the 89 under `src/app/api` reach for it — and its contract is two
 * things, not one: it answers 500 AND it logs the underlying error to the
 * server console. A test that drives a route into that
 * catch therefore prints a stack trace, by design — which is fine on a server
 * and is noise in `npx jest`, where it buries the one line that matters under
 * a screenful of `jest-circus` frames.
 *
 * ⚠️ **THIS EXISTS BECAUSE IT WAS ABOUT TO BE THE FOURTH COPY SITE — WHICH IS
 * ONE LATER THAN THE RULE ALLOWS, AND THE RULE IS QUOTED HERE AGAINST THIS
 * FILE RATHER THAN IN ITS FAVOUR.** `C:\dev\CLAUDE.md` → Design habits:
 * "Centralise a bypass rule at the third copy site, not the fourth." The third
 * site went in unremarked; this is the fourth, so the centralising is a slice
 * late. Three suites already spied on
 * `console.error` and restored it in a `finally` — `people-api.test.ts`,
 * `judicial-persons-api.test.ts`, `properties-api.test.ts` — each with its own
 * spelling of the same six lines. `role-attachment-door.test.ts` was about to
 * be the fourth, five times over, and was instead the reason to write this.
 *
 * ⚠️ **IT ASSERTS THE LOG RATHER THAN ONLY SWALLOWING IT, AND THAT IS THE
 * WHOLE DIFFERENCE FROM THE THREE COPIES IT REPLACES.** A bare
 * `mockImplementation(() => {})` is a blindfold: delete the `console.error`
 * from `unexpectedError` and every one of those three suites stays green, on
 * the half of the contract its own docstring states. Silencing a log you have
 * not checked fired is how a guard becomes decorative — the same shape this
 * codebase records for `AssertExactKeys` (`snapshot-registry.ts`: the check was
 * written without an initialiser, so it never fired) and for the `_2` refusal
 * that had a throw and no catcher. So the silence is a claim: the log HAPPENED,
 * and you simply did not have to look at it.
 *
 * ⚠️ **WHY IT IS NOT UNDER `src/__tests__/`.** Jest's default `testMatch`
 * claims every file under a `__tests__` folder, so a helper placed there is
 * loaded as a suite and fails with "Your test suite must contain at least one
 * test". `src/test-support/` is outside that pattern and outside the app's
 * import graph — nothing that ships may import from here, anywhere under
 * `src`. The older phrasing of this sentence named `src/app` and `src/lib`
 * only, which left `src/components`, `src/hooks`, `src/db` and `src/i18n` out;
 * `import-structure-rules.test.ts` now walks the whole of `src` and enforces
 * it. Same reasoning as `icu.ts` beside it, and this module needs it harder:
 * `icu.ts` in a bundle is dead weight, while a CALL to this one reaches
 * `jest.spyOn` and throws.
 *
 * ⚠️ **`finally`, NOT A BARE RESTORE.** The restore has to survive a failing
 * assertion inside `run`, or one red test silences `console.error` for every
 * test after it in the file — which would hide exactly the output this helper
 * exists to make meaningful, and only on the runs where something is already
 * wrong.
 */

/**
 * Run `run` with `console.error` silenced, assert it was called at least once,
 * and restore it — whatever `run` did.
 *
 * Returns whatever `run` returns, so the call site keeps its own assertions:
 *
 *   const res = await withExpectedServerErrorLog(() => route.post(body));
 *   expect(res.status).toBe(500);
 *
 * Use it ONLY where the log is expected, and only where `unexpectedError` is
 * what writes it: the assertion matches that function's `[<context>] error:`
 * prefix, so a route that logs its own 500 under a different prefix — and a
 * few do, e.g. `api/help/[screenKey]`, `api/properties/scan-image` and
 * `api/time-frames` — would fail this rather than be silenced by it. Anywhere
 * else, a stack trace in the jest output is a finding, and this helper would
 * turn it into an absence.
 */
export async function withExpectedServerErrorLog<T>(run: () => Promise<T>): Promise<T> {
  const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = await run();
    // ⚠️ **THE PREFIX, NOT `toHaveBeenCalled()`, AND A REVIEW ROUND IS WHY.**
    // A bare "something logged" passes on ANY console.error raised while `run`
    // ran — and today it would, because all four call sites are
    // `@jest-environment node` route tests where nothing else writes there. Use
    // this helper once from a jsdom suite and a React `act()` warning, a jsdom
    // "Not implemented: navigation", or a `next/image` notice satisfies it, and
    // the assertion is decorative again: the very shape the paragraph above
    // cites `AssertExactKeys` for. `unexpectedError` always writes its first
    // argument as `[<context>] error:` (errors.ts), so that is what is matched.
    //
    // Read off `mock.calls` rather than asserted with `toHaveBeenCalledWith`:
    // that matcher requires the whole argument list, and the second argument is
    // the caught value — which may legitimately be `null`, and `expect.anything()`
    // rejects null. The arity is not this helper's business; the prefix is.
    const logged = errSpy.mock.calls.some(
      ([first]) => typeof first === "string" && first.includes("] error:"),
    );
    // Inside the try on purpose: it must run before the restore, and a failure
    // here has to reach the caller as a failed test rather than be swallowed.
    //
    // The ternary is for the failure MESSAGE: on the happy path both sides are
    // "logged" and jest says nothing; when it fails, jest prints the calls that
    // DID happen beside the string it wanted, which is the one thing the reader
    // needs. `toBeGreaterThan(0)` on a count says "expected 0 to be greater
    // than 0" and leaves them guessing.
    expect(logged ? "logged" : errSpy.mock.calls).toBe("logged");
    return result;
  } finally {
    errSpy.mockRestore();
  }
}
