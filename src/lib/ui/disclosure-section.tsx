"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * A section that opens and closes — the WAI-ARIA accordion's one section.   (Slice #39.33)
 *
 * The title is a `<button>` inside the section's heading, with `aria-expanded` and `aria-controls`; Enter and Space
 * toggle it because it is a button. After the title, lucide's ChevronRight — turned down when open, `aria-hidden`.
 * The panel is a region labelled by the title and stays MOUNTED when closed (`hidden`), so what it holds is kept,
 * a form inside it still saves (Ctrl+S), and an error in it can open it and focus its field.
 *
 * A closed section may say what it holds — `summary`, quiet, after the title — so nothing hidden is missed; when it
 * holds an error, `error` says so in red instead (the save is blocked by something the user must be able to see).
 */
export function DisclosureSection({
  id,
  title,
  open,
  onToggle,
  summary,
  error,
  headingLevel = 3,
  className = "",
  children,
}: {
  /** Unique on the page: the button is `${id}-button`, the panel `${id}-panel`. */
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  summary?: string | null;
  error?: string | null;
  headingLevel?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const buttonId = `${id}-button`;
  const panelId = `${id}-panel`;
  const note = !open ? (error ?? summary ?? null) : null;
  return (
    <div data-disclosure={id} data-open={open ? "" : undefined} className={`flex min-w-0 flex-col ${className}`}>
      <Heading className="m-0 text-sm font-semibold text-ink dark:text-zinc-100">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full min-w-0 items-center gap-1.5 rounded-md py-1 text-left hover:text-[#3b5bdb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus dark:hover:text-[#768ce6]"
        >
          <span className="shrink-0">{title}</span>
          <ChevronRight
            aria-hidden="true"
            size={16}
            className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
          />
          {/* The space is text, so a screen reader — and the accessible name — reads „Memento · …", not „Memento· …". */}
          {note && " "}
          {note && (
            <span
              data-disclosure-note={error && !open ? "error" : "summary"}
              className={`min-w-0 truncate text-xs font-normal ${error ? "text-red-700 dark:text-red-400" : "text-fade dark:text-zinc-400"}`}
            >
              · {note}
            </span>
          )}
        </button>
      </Heading>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="pt-2">
        {children}
      </div>
    </div>
  );
}
