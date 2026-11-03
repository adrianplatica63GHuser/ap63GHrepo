/**
 * Three chevrons — „Toate sus" and „Toate la stânga" in „Panouri".                                  (Slice 41.60)
 *
 * Adrian, 2026-11-02: „the label of the buttons should be replaced with three chevrons pointing up or pointing left".
 * Lucide has only the double (ChevronsUp, ChevronsLeft), so the triple is drawn in Lucide's own shape (`Glyph`: a
 * 24-unit box, a 2-unit round stroke in currentColor, no fill), as the list icons are. Their words are the buttons'
 * names and hints (`IconButton`).
 */
import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

import { Glyph } from "@/components/icons/area-icons";

/** Three chevrons pointing up, one above another. */
export const TripleChevronUpIcon = forwardRef<SVGSVGElement, LucideProps>(function TripleChevronUpIcon(props, ref) {
  return (
    <Glyph ref={ref} name="triple-chevron-up" {...props}>
      <path d="m7 8 5-4.5 5 4.5" />
      <path d="m7 14 5-4.5 5 4.5" />
      <path d="m7 20 5-4.5 5 4.5" />
    </Glyph>
  );
});

/** Three chevrons pointing left, one beside another. */
export const TripleChevronLeftIcon = forwardRef<SVGSVGElement, LucideProps>(function TripleChevronLeftIcon(props, ref) {
  return (
    <Glyph ref={ref} name="triple-chevron-left" {...props}>
      <path d="m8 7-4.5 5 4.5 5" />
      <path d="m14 7-4.5 5 4.5 5" />
      <path d="m20 7-4.5 5 4.5 5" />
    </Glyph>
  );
});
