/**
 * The map's two area tools' glyphs.                                     (Slices #39.07, #39.08)
 *
 * Lucide has no rectangle with dots at its corners, nor a dotted one, so these are drawn in Lucide's own shape —
 * a 24-unit box, a 2-unit round stroke in currentColor, the `lucide` class — and take Lucide's props, so IconButton
 * draws them as it draws any other icon (#39.07's Ask first 4, #39.08's Ask first 2).
 */
import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

// Slice #39.09: forwardRef, as Lucide's own are, so a LucideIcon slot can carry one (the sidebar's „Calcul suprafață" did until #39.78).
// Slice 40.38: exported, so the lists' many-records icons (list-icons.tsx) are drawn in the same shape.
export const Glyph = forwardRef<SVGSVGElement, LucideProps & { name: string }>(function Glyph(
  { size = 24, className, strokeWidth = 2, absoluteStrokeWidth: _abs, name, children, ...rest },
  ref,
) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["lucide", `lucide-${name}`, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </svg>
  );
});

/** #39.07: a horizontal rectangle with heavy dots at its four corners — „Suprafața unei zone delimitate". */
export const AreaDelimitedIcon = forwardRef<SVGSVGElement, LucideProps>(function AreaDelimitedIcon(props, ref) {
  return (
    <Glyph ref={ref} name="area-delimited" {...props}>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      {[
        [3, 6],
        [21, 6],
        [21, 18],
        [3, 18],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" fill="currentColor" stroke="none" />
      ))}
    </Glyph>
  );
});

/** #39.08: a horizontal rectangle drawn with a dotted stroke, no corner dots — „Suprafața unei zone oarecare". */
export const AreaFreeIcon = forwardRef<SVGSVGElement, LucideProps>(function AreaFreeIcon(props, ref) {
  return (
    <Glyph ref={ref} name="area-free" {...props}>
      <rect x="3" y="6" width="18" height="12" rx="1" strokeDasharray="0.5 3.5" />
    </Glyph>
  );
});
