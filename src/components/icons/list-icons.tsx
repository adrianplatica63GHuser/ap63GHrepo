/**
 * The four principal lists' many-records icons, before each list's title.                          (Slice 40.38)
 *
 * Adrian, 2026-10-23: „please insert the appropriate icon (just inspired from the file, not copy and paste) before the
 * title of each list … The icons in the file represent multiple objects of that type". Big.Icons.docx holds a group of
 * people, three office blocks, a folded map with three pins, three stacked pages — so these are those four ideas drawn
 * by hand in Lucide's own shape (`Glyph`: a 24-unit box, a 2-unit round stroke in currentColor, no fill), to sit beside
 * Lucide's icons without looking borrowed and to follow the title's colour and dark mode (40.38's Ask first 1).
 *
 * Drawn at 30 px (1.25em of the title) they keep the stroke the record screens' 24-px icons have, scaled: a 24-unit
 * box keeps the drawing simple enough to read at that size — three people rather than the picture's five, a dot in
 * the middle pin rather than a house in each.
 */
import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

import { Glyph } from "@/components/icons/area-icons";

/** Persoane fizice — three people, the front one in the middle. */
export const PeopleGroupIcon = forwardRef<SVGSVGElement, LucideProps>(function PeopleGroupIcon(props, ref) {
  return (
    <Glyph ref={ref} name="people-group" {...props}>
      <circle cx="12" cy="9.5" r="3" />
      <path d="M6.5 21v-1a5.5 5.5 0 0 1 11 0v1" />
      <circle cx="4.8" cy="7.5" r="2.2" />
      <path d="M1 16.5v-.5a3.8 3.8 0 0 1 5.2-3.5" />
      <circle cx="19.2" cy="7.5" r="2.2" />
      <path d="M23 16.5v-.5a3.8 3.8 0 0 0-5.2-3.5" />
    </Glyph>
  );
});

/** Persoane juridice — three office blocks, the middle one tallest, on one ground line. */
export const BuildingsIcon = forwardRef<SVGSVGElement, LucideProps>(function BuildingsIcon(props, ref) {
  return (
    <Glyph ref={ref} name="buildings" {...props}>
      <path d="M9 21V3.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V21" />
      <path d="M9 9H3.5a.5.5 0 0 0-.5.5V21" />
      <path d="M15 7h5.5a.5.5 0 0 1 .5.5V21" />
      <path d="M1.5 21h21" />
      <path d="M11.5 7h1M11.5 11h1M11.5 15h1" />
      <path d="M5.5 13h1M5.5 17h1M17.5 11h1M17.5 15h1" />
    </Glyph>
  );
});

/** Proprietăți — a folded map under three location pins. */
export const MapPinsIcon = forwardRef<SVGSVGElement, LucideProps>(function MapPinsIcon(props, ref) {
  return (
    <Glyph ref={ref} name="map-pins" {...props}>
      <path d="M2 18l5-2 5 2 5-2 5 2v4l-5-2-5 2-5-2-5 2z" />
      <path d="M12 14s-3-2.9-3-5.3a3 3 0 0 1 6 0c0 2.4-3 5.3-3 5.3z" />
      <circle cx="12" cy="8.7" r=".6" />
      <path d="M5 12.5S3 10.6 3 9a2 2 0 0 1 4 0c0 1.6-2 3.5-2 3.5z" />
      <path d="M19 12.5s-2-1.9-2-3.5a2 2 0 0 1 4 0c0 1.6-2 3.5-2 3.5z" />
    </Glyph>
  );
});

/** Acte — three stacked pages, the front one with lines of text. */
export const PagesIcon = forwardRef<SVGSVGElement, LucideProps>(function PagesIcon(props, ref) {
  return (
    <Glyph ref={ref} name="pages" {...props}>
      <path d="M10 2h6l4 4v11" />
      <path d="M7 4.5h6l4 4V19" />
      <path d="M4 7h6l4 4v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <path d="M6 14h5M6 18h3" />
    </Glyph>
  );
});
