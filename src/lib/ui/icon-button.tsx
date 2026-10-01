"use client";

/**
 * IconButton — one icon button for the whole app.                (Slice #37.42)
 *
 * A Lucide icon in a square button, its label shown as a tooltip on mouse hover
 * and on keyboard focus, and kept as its accessible name. Adrian decided which
 * button gets which icon in `GA40-CTA-Icon-Map.xlsx` (#37.41); #37.42–#37.47
 * move the app's buttons onto this component a screen family at a time.
 *
 * ⚠️ **THE ACCESSIBLE NAME DOES NOT CHANGE.** An icon-only button's
 * `aria-label` is the Romanian text it showed before, from the same message
 * key, so every e2e locator that finds it with `getByRole(…, { name })` keeps
 * passing untouched. The tooltip shows that same text, so it needs no
 * `aria-describedby` — it would only make a screen reader read the name twice.
 *
 * WHAT IT IS BUILT ON, rather than beside:
 *  - **`buttonClass`** for every class, so the variants keep their colours
 *    (danger stays danger) and the disabled look stays the one #26.11 fixed.
 *    `iconOnly` gives the square, exactly as tall as a text button of the same
 *    size; a link takes `linkClass`, whose hover a `<Link>` can actually match.
 *  - **`useTooltipTriggers`** for when the tooltip opens and closes — the one
 *    copy HintBubble also uses: mouse hover (not touch), keyboard focus (not a
 *    mouse focus), Escape without taking Escape from a dialog.
 *
 * ⚠️ **A DISABLED ICON BUTTON STILL SHOWS ITS TOOLTIP ON HOVER.** HintBubble is
 * silent on a disabled control, because its text is extra; an icon button's
 * tooltip is its NAME, and „what is this greyed-out thing" is exactly when a
 * user needs it. A disabled `<button>` does not reliably receive pointer
 * events in every browser, so the handlers sit on a wrapper `<span>` and the
 * disabled button lets the pointer through to it (`disabled:pointer-events-none`).
 *
 * ⚠️ **THE TOOLTIP IS PORTALLED TO `<body>`, POSITIONED `fixed`.** Half the
 * sites sit inside a table frame that scrolls sideways (`TABLE_FRAME`'s
 * `overflow-x-auto`) or in the sidebar, which is `overflow-hidden` so it can
 * animate its width; an `absolute` bubble would be clipped in both. It is
 * placed under the button, centred, kept inside the window, and flipped above
 * the button when there is no room below — measured in a layout effect, before
 * paint, with no state round trip.
 *
 * Like everything under `src/lib/ui/`, it takes its strings as props and never
 * calls next-intl.
 */

import Link from "next/link";
import {
  useId,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, type LucideProps } from "lucide-react";

import {
  buttonClass,
  linkClass,
  type ButtonSize,
  type ButtonVariant,
} from "@/lib/ui/button-styles";
import { useTooltipTriggers } from "@/lib/ui/use-tooltip";

/**
 * The icon's size per button size: 16px at xs and sm, 18px at md and lg, with
 * Lucide's default stroke. 16px is the xs/sm text line exactly; 18px sits
 * inside md/lg's 20px line, so an icon + label button is no taller than the
 * label alone.
 */
export const ICON_PX: Record<ButtonSize, number> = { xs: 16, sm: 16, md: 18, lg: 18 };

/** The gap between the icon and the label of an icon + label button. */
const LABEL_GAP = "gap-1.5";

// ── The tooltip ──────────────────────────────────────────────────────────────

/** Space kept between the tooltip and the control, and the window's edge. */
const GAP_PX = 6;
const EDGE_PX = 4;

/**
 * Put the bubble under the anchor, centred, inside the window; above it when
 * the window has no room below. Writes the position straight onto the node.
 */
function place(anchor: HTMLElement, tip: HTMLElement): void {
  const a = anchor.getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const maxLeft = Math.max(EDGE_PX, window.innerWidth - w - EDGE_PX);
  const left = Math.min(Math.max(EDGE_PX, a.left + a.width / 2 - w / 2), maxLeft);
  const below = a.bottom + GAP_PX;
  const top = below + h > window.innerHeight - EDGE_PX ? Math.max(EDGE_PX, a.top - GAP_PX - h) : below;
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

type IconTooltipProps = {
  /** The text shown — for an icon button, its accessible name. */
  label: string;
  /** A second, smaller line under the label: why the control is as it is (#37.43). */
  note?: string;
  /** The control. Its own name must already be `label`. */
  children: ReactNode;
  /** Layout extras for the wrapper (`ml-auto`, `shrink-0`). */
  className?: string;
  /**
   * The wrapper spans its container's width (the sidebar's rows) instead of
   * hugging the control. Without it the wrapper is `w-fit`, so a flex column
   * that stretches its children cannot widen it into a strip whose empty part
   * opens the tooltip — the option rather than an appended `w-full`, which
   * would fight the `w-fit` (`button-styles.ts`'s header).
   */
  fill?: boolean;
};

/**
 * The label tooltip on its own, for a control that keeps its own look and is
 * already an icon: the sidebar's collapsed rows, „Ajutor" and „Sfat" (A001,
 * A005, A006). IconButton uses it for every icon-only button.
 *
 * It closes when the control is pressed as well — `pointerdown` for a mouse,
 * the click a keyboard's Enter or Space produces — because pressing it is the
 * moment the user stops asking what it is, and a bubble left over a popover
 * the press just opened („Ajutor") would cover it. (HintBubble does not do this — its ⓘ's click is
 * what toggles its bubble.)
 */
export function IconTooltip({ label, note, children, className, fill = false }: IconTooltipProps) {
  const { isOpen, setOpen, wrapRef, handlers } = useTooltipTriggers<HTMLSpanElement>();
  const tipRef = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const anchor = wrapRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const update = () => place(anchor, tip);
    update();
    // Capture: a scroll inside any container (a table frame, the page's own
    // column) moves the anchor, not only a scroll of the window.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, label, wrapRef]);

  return (
    <span
      ref={wrapRef}
      className={[fill ? "flex w-full" : "inline-flex w-fit", className].filter(Boolean).join(" ")}
      {...handlers}
      onPointerDown={() => setOpen(false)}
      onClickCapture={() => setOpen(false)}
    >
      {children}
      {isOpen &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            data-icon-tooltip=""
            style={{ left: 0, top: 0 }}
            className="pointer-events-none fixed z-[70] max-w-[20rem] rounded-md border border-card-rim bg-white px-2 py-1 text-xs leading-snug font-medium text-ink shadow-lg dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {label}
            {note && <span className="mt-0.5 block font-normal text-fade dark:text-zinc-400">{note}</span>}
          </span>,
          document.body,
        )}
    </span>
  );
}

// ── The button ───────────────────────────────────────────────────────────────

type Common = {
  /**
   * A Lucide icon component, e.g. `ArrowLeft` — or a component that draws one
   * with Lucide's props (#37.44's filled BadgeCheck).
   */
  icon: ComponentType<LucideProps>;
  /**
   * What the button does, in the words it used to show — its accessible name,
   * and its tooltip when the words are not on screen.
   */
  label: string;
  variant: ButtonVariant;
  /** Defaults to "md", as `buttonClass` does. */
  size?: ButtonSize;
  /** Icon + label: the icon before the visible label, and no tooltip (A011). */
  showLabel?: boolean;
  /**
   * Working: a spinning LoaderCircle in place of the icon, and `busyLabel`
   * („Se salvează…") as the name and the tooltip. An icon + label button
   * keeps its label on screen, so it keeps its width.
   */
  busy?: boolean;
  busyLabel?: string;
  /**
   * A number shown as a small badge on the icon's corner (A012's selection
   * count). Zero or less shows no badge. The label must carry the number too —
   * it is the name and the tooltip.
   */
  count?: number;
  /** Fully rounded, as `buttonClass`'s `pill`. */
  pill?: boolean;
  /**
   * Why the button is as it is — „Modifică" disabled on an older version says
   * so (#37.43; it was the button's `title`). Shown in the tooltip under the
   * label, and the button's description through `aria-describedby` on a hidden
   * span — not `aria-description`, which jsx-a11y rightly calls unsupported.
   */
  note?: string;
  /** Layout extras for the outer wrapper only (`ml-auto`, `shrink-0`). */
  className?: string;
};

type AsButton = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "aria-label"> & {
    href?: undefined;
    /**
     * The `<button>` itself (#37.43): a dialog that returns focus to its close
     * button, or focuses it on open, holds a ref to it. React 19 passes `ref`
     * to a function component as a prop, so it rides in with the rest.
     */
    ref?: Ref<HTMLButtonElement>;
  };

type AsLink = Common &
  Omit<ComponentProps<typeof Link>, "children" | "className" | "aria-label" | "href"> & {
    /** Renders a next/link `<Link>` instead of a `<button>`. */
    href: string;
  };

export type IconButtonProps = AsButton | AsLink;

export function IconButton(props: IconButtonProps) {
  const {
    icon: Icon,
    label,
    variant,
    size = "md",
    showLabel = false,
    busy = false,
    busyLabel,
    count,
    pill,
    note,
    className,
    ...rest
  } = props;

  const noteId = useId();
  // A caller's own description (a hint beside a disabled button) and the note's
  // are both kept: the attribute takes a list of ids.
  const callerDescribedBy = (rest as { "aria-describedby"?: string })["aria-describedby"];
  const describedBy = [callerDescribedBy, note ? noteId : undefined].filter(Boolean).join(" ") || undefined;
  const name = busy && busyLabel ? busyLabel : label;
  const px = ICON_PX[size];
  const badge = count !== undefined && count > 0 ? count : null;
  const options = {
    variant,
    size,
    pill,
    iconOnly: !showLabel,
    className: [
      "relative",
      showLabel ? LABEL_GAP : "",
      // Lets the pointer through to the wrapper, whose handlers open the
      // tooltip — see the module note on disabled buttons.
      "disabled:pointer-events-none",
    ]
      .filter(Boolean)
      .join(" "),
  };

  const glyph = busy ? (
    // `motion-reduce:` — under prefers-reduced-motion the spinner holds still.
    <LoaderCircle size={px} aria-hidden="true" className="shrink-0 animate-spin motion-reduce:animate-none" />
  ) : (
    <Icon size={px} aria-hidden="true" className="shrink-0" />
  );

  const inner = (
    <>
      {glyph}
      {showLabel && <span>{label}</span>}
      {badge !== null && (
        <span
          aria-hidden="true"
          data-icon-badge=""
          className="pointer-events-none absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-white px-1 text-center text-[10px] leading-4 font-semibold text-ink shadow-sm ring-1 ring-card-rim dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-600"
        >
          {badge}
        </span>
      )}
    </>
  );

  // Icon + label at rest: the words are the name, so no aria-label and no
  // tooltip. Busy, the words on screen stay (the width holds) but the name is
  // the busy text, which the tooltip shows.
  const ariaLabel = showLabel && !busy ? undefined : name;
  const tooltip = !showLabel || (busy && name !== label) || Boolean(note);

  let control: ReactNode;
  if (rest.href !== undefined) {
    const { href, ...linkRest } = rest as Omit<AsLink, keyof Common>;
    control = (
      <Link href={href} {...linkRest} aria-label={ariaLabel} aria-describedby={describedBy} className={linkClass(options)}>
        {inner}
      </Link>
    );
  } else {
    const { type = "button", disabled, ...buttonRest } = rest as Omit<AsButton, keyof Common>;
    control = (
      <button
        type={type}
        disabled={disabled}
        aria-busy={busy || undefined}
        {...buttonRest}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        className={buttonClass(options)}
      >
        {inner}
      </button>
    );
  }

  // The note's text for `aria-describedby`; `hidden`, because the tooltip is
  // where the eye reads it.
  if (note) {
    control = (
      <>
        {control}
        <span id={noteId} hidden>
          {note}
        </span>
      </>
    );
  }

  const disabled = "disabled" in rest && rest.disabled === true;
  const wrapClass = [disabled ? "cursor-not-allowed" : "", className].filter(Boolean).join(" ");

  if (!tooltip) {
    return wrapClass ? <span className={`inline-flex w-fit ${wrapClass}`}>{control}</span> : <>{control}</>;
  }
  return (
    <IconTooltip label={name} note={note} className={wrapClass}>
      {control}
    </IconTooltip>
  );
}
