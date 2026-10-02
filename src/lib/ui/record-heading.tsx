/**
 * RecordHeading — a record's name at the top of its screen, after its icon.
 *                                                              (Slice #37.49)
 *
 * The Natural Person, Judicial Person, Property and Document screens open on
 * an `<h1>` holding the record's name. Since #37.49 the name is preceded by
 * the icon the app already uses for that kind of record — `User`, `Building2`,
 * `Map` (the sidebar's „Hartă proprietăți", the folded map), `FileText` — so
 * the four headers draw it through this one component, not four copies.
 *
 * ⚠️ **THE HEADING'S NAME DOES NOT CHANGE.** The icon is `aria-hidden`, so the
 * `<h1>`'s accessible name is the record's name alone and every
 * `getByRole("heading", { name })` keeps passing.
 *
 * ⚠️ **THE SIZE FOLLOWS THE NAME.** The icon is `1em` square, i.e. the
 * heading's own font size (`text-2xl` today, 24 px), so it is as tall as the
 * letters and follows the heading if its size changes. The gap is a margin of
 * `0.55em` — two spaces at that size — never two non-breaking spaces inside
 * the name, which would land in the accessible name and in `title`.
 *
 * ⚠️ **A LONG NAME TRUNCATES, THE ICON NEVER SHRINKS.** With `truncate` the
 * name sits in its own `min-w-0 truncate` span, the `<h1>` is a flex row and
 * the icon `shrink-0`, so the ellipsis eats the name and the icon stays whole.
 *
 * Like everything under `src/lib/ui/`, it takes its strings as props and never
 * calls next-intl.
 */

import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

export type RecordHeadingProps = {
  /** The record kind's Lucide icon. */
  icon: ComponentType<LucideProps>;
  /** The record's name, exactly as the heading shows it. */
  name: string;
  /** Cut a long name with an ellipsis instead of wrapping (the Document). */
  truncate?: boolean;
  /** Extra classes for the `<h1>` (e.g. a minimum width). */
  className?: string;
  /** A tooltip for the whole heading — the Document gives its full name. */
  title?: string;
};

export function RecordHeading({ icon: Icon, name, truncate = false, className, title }: RecordHeadingProps) {
  return (
    <h1
      className={["flex min-w-0 items-center text-2xl font-semibold tracking-tight", className]
        .filter(Boolean)
        .join(" ")}
      title={title}
    >
      <Icon
        aria-hidden="true"
        focusable="false"
        data-record-icon=""
        className="mr-[0.55em] h-[1em] w-[1em] shrink-0"
      />
      <span className={truncate ? "min-w-0 truncate" : "min-w-0"}>{name}</span>
    </h1>
  );
}
