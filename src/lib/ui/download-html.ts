/**
 * Hand a string of HTML to the browser as a download.   (Slice #26.04)
 *
 * Extracted from `report-sections.tsx` when the Structure stage became the
 * second place that saves a take-away page. The three lines are obvious; the
 * fourth is not, and it is the whole reason this is a function rather than a
 * copy-paste:
 *
 *   **the object URL is revoked on the NEXT tick, never in the same frame as
 *   the click.** Firefox and Safari have both been observed to cancel a
 *   download whose URL is revoked synchronously after `click()`.
 *
 * A second copy would get the first three lines right and lose that one, and
 * the failure is silent — no error, no file, and nothing to grep for.
 *
 * Browser-only: it touches `document` and `URL`, so it is called from event
 * handlers in client components and never during render or on the server.
 */
export function downloadHtmlFile(html: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * `YYYYMMDD-HHMM` in the user's own clock, for a filename that sorts by time.
 *
 * Local rather than UTC on purpose: the user is looking for "the one I saved
 * this afternoon", and an evening save in Bucharest that files itself under
 * the previous hour is a file they cannot find. Not `toISOString`, which is
 * UTC and carries punctuation Windows refuses.
 */
export function fileNameStamp(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  );
}
