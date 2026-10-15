/**
 * The manual's chapters, in order, per language.                                          (Slice #39.37)
 *
 * One source per chapter per language (Ask first 2). Chapter order is THIS list's order; `validateManual` checks
 * that it agrees with the numbers the chapters carry.
 */
import type { ManualLocale } from "@/lib/manual/format";
import { CHAPTER as RO01 } from "@/lib/manual/content/ro-RO/01-intro";
import { CHAPTER as RO02 } from "@/lib/manual/content/ro-RO/02-start";
import { CHAPTER as RO03 } from "@/lib/manual/content/ro-RO/03-persons";
import { CHAPTER as RO04 } from "@/lib/manual/content/ro-RO/04-companies";
import { CHAPTER as RO05 } from "@/lib/manual/content/ro-RO/05-properties";
import { CHAPTER as RO06 } from "@/lib/manual/content/ro-RO/06-documents";
import { CHAPTER as RO07 } from "@/lib/manual/content/ro-RO/07-links";
import { CHAPTER as RO08 } from "@/lib/manual/content/ro-RO/08-map";
import { CHAPTER as RO09 } from "@/lib/manual/content/ro-RO/09-tools";
import { CHAPTER as RO10 } from "@/lib/manual/content/ro-RO/10-import";
import { CHAPTER as RO11 } from "@/lib/manual/content/ro-RO/11-reports";
import { CHAPTER as RO12 } from "@/lib/manual/content/ro-RO/12-admin";
import { CHAPTER as RO13 } from "@/lib/manual/content/ro-RO/13-learning";
import { CHAPTER as EN01 } from "@/lib/manual/content/en-GB/01-intro";
import { CHAPTER as EN02 } from "@/lib/manual/content/en-GB/02-start";
import { CHAPTER as EN03 } from "@/lib/manual/content/en-GB/03-persons";
import { CHAPTER as EN04 } from "@/lib/manual/content/en-GB/04-companies";
import { CHAPTER as EN05 } from "@/lib/manual/content/en-GB/05-properties";
import { CHAPTER as EN06 } from "@/lib/manual/content/en-GB/06-documents";
import { CHAPTER as EN07 } from "@/lib/manual/content/en-GB/07-links";
import { CHAPTER as EN08 } from "@/lib/manual/content/en-GB/08-map";
import { CHAPTER as EN09 } from "@/lib/manual/content/en-GB/09-tools";
import { CHAPTER as EN10 } from "@/lib/manual/content/en-GB/10-import";
import { CHAPTER as EN11 } from "@/lib/manual/content/en-GB/11-reports";
import { CHAPTER as EN12 } from "@/lib/manual/content/en-GB/12-admin";
import { CHAPTER as EN13 } from "@/lib/manual/content/en-GB/13-learning";

export const MANUAL_SOURCES: Readonly<Record<ManualLocale, readonly { source: string; text: string }[]>> = {
  "ro-RO": [
    { source: "ro-RO/01-intro", text: RO01 },
    { source: "ro-RO/02-start", text: RO02 },
    { source: "ro-RO/03-persons", text: RO03 },
    { source: "ro-RO/04-companies", text: RO04 },
    { source: "ro-RO/05-properties", text: RO05 },
    { source: "ro-RO/06-documents", text: RO06 },
    { source: "ro-RO/07-links", text: RO07 },
    { source: "ro-RO/08-map", text: RO08 },
    { source: "ro-RO/09-tools", text: RO09 },
    { source: "ro-RO/10-import", text: RO10 },
    { source: "ro-RO/11-reports", text: RO11 },
    { source: "ro-RO/12-admin", text: RO12 },
    { source: "ro-RO/13-learning", text: RO13 },
  ],
  "en-GB": [
    { source: "en-GB/01-intro", text: EN01 },
    { source: "en-GB/02-start", text: EN02 },
    { source: "en-GB/03-persons", text: EN03 },
    { source: "en-GB/04-companies", text: EN04 },
    { source: "en-GB/05-properties", text: EN05 },
    { source: "en-GB/06-documents", text: EN06 },
    { source: "en-GB/07-links", text: EN07 },
    { source: "en-GB/08-map", text: EN08 },
    { source: "en-GB/09-tools", text: EN09 },
    { source: "en-GB/10-import", text: EN10 },
    { source: "en-GB/11-reports", text: EN11 },
    { source: "en-GB/12-admin", text: EN12 },
    { source: "en-GB/13-learning", text: EN13 },
  ],
};
