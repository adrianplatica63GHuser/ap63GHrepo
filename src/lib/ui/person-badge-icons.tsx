/**
 * Two composed icons for the inheritance tree tile's buttons (Slice 41.72): a person with a chain link, „Adaugă o
 * rudă", and a person with a bin, „Scoate o rudă".
 *
 * Adrian, 2026-11-03: „the first button showing a person and a chain link … the second button showing a person and the
 * garbage bin". Lucide has neither, so each is Lucide's User, drawn smaller at the top left, with a small Link2 or
 * Trash2 at its lower right (Ask first 1) — one component each, taking a Lucide icon's props (`size`, `color`,
 * `strokeWidth`, `className`), so IconButton draws them at its size and in its colour like any other icon. The lines
 * keep a Lucide icon's 2-px weight at every size: each nested icon's stroke is scaled up by what its box shrinks it.
 */
import { forwardRef, type ComponentType } from "react";
import { Link2, Trash2, User, type LucideIcon, type LucideProps } from "lucide-react";

/** The person's box and the badge's, in the 24-unit grid every Lucide icon is drawn on. */
const PERSON = { x: 0, y: 0, size: 17 };
const BADGE = { x: 11, y: 11, size: 13 };

function personWith(Badge: ComponentType<LucideProps>, name: string): LucideIcon {
  const Composed = forwardRef<SVGSVGElement, LucideProps>(function Composed(
    { size = 24, color = "currentColor", strokeWidth = 2, className, ...rest },
    ref,
  ) {
    const stroke = Number(strokeWidth);
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={["lucide", className].filter(Boolean).join(" ")}
        data-composed-icon={name}
        {...rest}
      >
        <User x={PERSON.x} y={PERSON.y} width={PERSON.size} height={PERSON.size} color={color} strokeWidth={(stroke * 24) / PERSON.size} />
        <Badge x={BADGE.x} y={BADGE.y} width={BADGE.size} height={BADGE.size} color={color} strokeWidth={(stroke * 24) / BADGE.size} />
      </svg>
    );
  });
  Composed.displayName = name;
  return Composed as LucideIcon;
}

/** „Adaugă o rudă": a person and a chain link. */
export const PersonLinkIcon = personWith(Link2, "PersonLinkIcon");
/** „Scoate o rudă": a person and a bin. */
export const PersonBinIcon = personWith(Trash2, "PersonBinIcon");
