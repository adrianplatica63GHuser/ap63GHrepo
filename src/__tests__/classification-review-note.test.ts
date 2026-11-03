/**
 * Slice 41.37 — Adrian: „For Classification tile please move the “i” button right after the title of the tile; add to
 * the information message some clarification on the timeline for metadata reviews".
 *
 * The bubble's „Revizuire" paragraph says after how many days a value is flagged, what „Marchează ca verificat" does,
 * that a change made today counts as reviewed, when the dashboard counts the record, and where both are changed — its
 * day counts read live from the two settings through `tfDays`, the helper the red warning uses, never written in.
 */
import { readFileSync } from "fs";
import { join } from "path";
import ro from "../../messages/ro-RO.json";
import en from "../../messages/en-GB.json";

const META = readFileSync(join(process.cwd(), "src/components/entity-metadata-tab.tsx"), "utf8");
const TITLE = readFileSync(join(process.cwd(), "src/components/tiles/tile-title.tsx"), "utf8");
const LIST = readFileSync(join(process.cwd(), "src/components/tiles/list-tile.tsx"), "utf8");

describe("41.37 — Clasificare's „i” and its review paragraph", () => {
  it("both settings, through the warning's own helper", () => {
    expect(META).toContain('const reviewWarnDays = tfDays(tf, "metadata_review_warning");');
    expect(META).toContain('const reviewStaleDays = tfDays(tf, "dashboard_stale_metadata");');
    expect(META).toContain('{t("review.note", { warn: reviewWarnDays, stale: reviewStaleDays })}');
    // The red warning reads the same setting the same way.
    expect(META).toMatch(/function buildReviewWarning[\s\S]{0,200}tfDays\(tf, "metadata_review_warning"\)/);
  });

  it("the paragraph in both languages, Romanian first; no day count written into the text", () => {
    expect(ro.shared.entityMetadata.review.title).toBe("Revizuire");
    expect(en.shared.entityMetadata.review.title).toBe("Review");
    for (const note of [ro.shared.entityMetadata.review.note, en.shared.entityMetadata.review.note]) {
      expect(note).toMatch(/\{warn, plural, /);
      expect(note).toMatch(/\{stale, plural, /);
      expect(note).not.toMatch(/\b\d+\b/);
    }
    // The names it quotes are the app's own.
    expect(ro.shared.entityMetadata.review.note).toContain(`„${ro.shared.entityMetadata.markReviewed.button}”`);
    // The menu's „Tablou de bord", articulated in the sentence: „Tabloul de bord".
    expect(ro.shared.entityMetadata.review.note).toContain(ro.nav.sections.dashboard.replace(/^Tablou /, "Tabloul "));
    expect(en.shared.entityMetadata.review.note).toContain(en.nav.sections.dashboard);
  });

  // 41.59 (Ask first 4): rewritten for one block — the three together, the oldest's date, „Salvează" confirming too,
  // and the way back.
  it("41.59: the paragraph speaks of one block, the save confirming too, and „Înapoi”", () => {
    const r = ro.shared.entityMetadata;
    expect(r.review.note).toContain("un singur bloc");
    expect(r.review.note).toContain("celei mai vechi");
    expect(r.review.note).toContain(`„${r.save}”`);
    expect(r.review.note).toContain(`„${r.confirmReview.back}”`);
    const e = en.shared.entityMetadata;
    expect(e.review.note).toContain("one block");
    expect(e.review.note).toContain(`„${e.save}”`);
    expect(e.review.note).toContain(`„${e.confirmReview.back}”`);
    expect([r.confirmReview.ok, e.confirmReview.ok]).toEqual(["Confirmă", "Confirm"]);
    expect(r.confirmReview.heading).toBe("Confirmați că toate trei sunt încă valabile azi:");
  });

  it("the „i” right after the title, outside the heading, through the tile's hint slot", () => {
    // 41.38: the line holds the action too now, at its right end.
    expect(TITLE).toMatch(/<div className="flex items-start gap-1\.5" data-tile-title-line="">\s*\{heading\}\s*\{hint && /);
    expect(LIST).toContain('hint={<span ref={setHintSlot} className="flex items-center empty:hidden" data-tile-hint-slot="" />}');
    expect(META).toContain("{!folded && chrome && <TileHint>{aboutBubble}</TileHint>}");
    // The top line is the version controls' again, drawn only with several versions (or with no tile around it).
    expect(META).toContain("{!folded && (totalVer > 1 || !chrome) && (");
  });
});
