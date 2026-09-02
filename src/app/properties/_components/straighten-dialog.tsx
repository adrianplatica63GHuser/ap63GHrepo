"use client";

import { useTranslations } from "next-intl";
import type { PlanarPoint } from "@/lib/properties/area";
import { buttonClass } from "@/lib/ui/button-styles";

/**
 * Slice #32.14 — the confirmation for "straighten the corner order".
 *
 * ⚠️ IT SHOWS THE SHAPE, AND THAT IS NOT DECORATION. `straightenPolygonOrder`
 * uses the declared surface area to choose between two rings that are both
 * simple, which measurably helps — but it also converts some "wrong ring,
 * visibly wrong area" into "wrong ring, area exactly as declared". A dialog
 * that showed only two numbers would therefore be least trustworthy on exactly
 * the cases where it most needs to be. The corners themselves never move; it is
 * their order that changes, and a wrong order is obvious as a picture and
 * invisible as a figure. See the docblock on `straightenPolygonOrder`.
 *
 * A dialog of its own rather than the `ConfirmDialog` in property-form.tsx,
 * whose `body` is a string and whose box is `max-w-sm` — widening a component
 * three other dialogs already use, to serve one of them, is the wrong trade.
 */

type Props = {
  /** Current corner order, projected to Stereo 70 metres. */
  points: PlanarPoint[];
  /** The proposed order, as indices into `points`. */
  order: number[];
  /** Each corner's own number — `originalIndex` where there is one. */
  numbers: (number | null)[];
  currentAreaM2: number;
  proposedAreaM2: number;
  /** The parcel's declared surface area, when it has one. */
  declaredAreaM2: number | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A corner's own number, or an em dash when it has none.
 *
 * ⚠️ NOT THE ROW POSITION AS A FALLBACK, WHICH AN EARLIER VERSION USED.
 * `original_index` is nullable by design — manual entry, OCR groups and the
 * legacy 2-column text format all produce corners without one, and the corners
 * table renders those as "—". Substituting the position here prints a number
 * that looks like a source number and is not: a set of `[4, null, 5, 13, 14]`
 * came out as `4, 2, 5, 13, 14`, with the invented 2 sitting directly above
 * the sentence promising that every corner keeps its own number. That is the
 * one place in the product where a fabricated number would be believed.
 */
function labelFor(numbers: (number | null)[], index: number): string {
  const own = numbers[index];
  return own == null ? "—" : String(own);
}

function formatArea(v: number): string {
  return v.toFixed(2);
}

/**
 * The ring as a small SVG. North is up, so the y axis is flipped; the box is
 * scaled to the corner set's own extent, which means the two previews share a
 * scale only when the shapes share an extent — they always do here, because
 * they are the same corners in a different order.
 */
function RingPreview({
  points,
  order,
  crossed,
}: {
  points: PlanarPoint[];
  order: number[];
  crossed: boolean;
}) {
  const SIZE = 120;
  const PAD = 8;

  const easts = points.map((p) => p.east);
  const norths = points.map((p) => p.north);
  const minE = Math.min(...easts);
  const maxE = Math.max(...easts);
  const minN = Math.min(...norths);
  const maxN = Math.max(...norths);

  // A degenerate extent (every corner on one line) would divide by zero.
  const spanE = maxE - minE || 1;
  const spanN = maxN - minN || 1;
  const scale = (SIZE - 2 * PAD) / Math.max(spanE, spanN);

  const xy = (p: PlanarPoint) => [
    PAD + (p.east - minE) * scale,
    // y grows downwards in SVG; north grows upwards on the ground.
    SIZE - PAD - (p.north - minN) * scale,
  ];

  const d = order
    .map((i, k) => {
      const [x, y] = xy(points[i]);
      return `${k === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ") + " Z";

  const stroke = crossed ? "#d97706" : "#0f766e";

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-28 w-28 shrink-0"
      role="presentation"
    >
      <path d={d} fill={stroke} fillOpacity={0.12} stroke={stroke} strokeWidth={1.5} />
      {order.map((i, k) => {
        const [x, y] = xy(points[i]);
        return <circle key={k} cx={x} cy={y} r={2.2} fill={stroke} />;
      })}
    </svg>
  );
}

export function StraightenDialog({
  points,
  order,
  numbers,
  currentAreaM2,
  proposedAreaM2,
  declaredAreaM2,
  onConfirm,
  onCancel,
}: Props) {
  const t = useTranslations("property.bowTie.dialog");

  const currentOrder = points.map((_, i) => i);
  const beforeNumbers = currentOrder.map((i) => labelFor(numbers, i)).join(", ");
  const afterNumbers = order.map((i) => labelFor(numbers, i)).join(", ");
  const movedRows = order.filter((v, k) => v !== k).length;

  // With no source numbers at all, the before/after line would read
  // "—, —, —, — → —, —, —, —", which says nothing. The guarantee it
  // illustrates is then vacuous too, so only the row count is shown.
  const hasOwnNumbers = numbers.some((n) => n != null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="straighten-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <h3
          id="straighten-title"
          className="text-base font-semibold text-ink dark:text-zinc-100"
        >
          {t("title")}
        </h3>

        <p className="mt-2 text-sm text-fade dark:text-zinc-400">{t("intro")}</p>

        {/* The shapes, side by side, at one scale. */}
        <div className="mt-4 flex items-start justify-center gap-6">
          <figure className="flex flex-col items-center gap-1">
            <RingPreview points={points} order={currentOrder} crossed />
            <figcaption className="text-xs font-medium text-fade dark:text-zinc-400">
              {t("before")}
            </figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-1">
            <RingPreview points={points} order={order} crossed={false} />
            <figcaption className="text-xs font-medium text-fade dark:text-zinc-400">
              {t("after")}
            </figcaption>
          </figure>
        </div>

        {/* The numbers, including the declared one to compare against. */}
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-fade dark:text-zinc-400">{t("areaBefore")}</dt>
          <dd className="font-mono text-ink dark:text-zinc-300">
            {formatArea(currentAreaM2)}
          </dd>
          <dt className="text-fade dark:text-zinc-400">{t("areaAfter")}</dt>
          <dd className="font-mono font-semibold text-ink dark:text-zinc-200">
            {formatArea(proposedAreaM2)}
          </dd>
          {declaredAreaM2 != null && (
            <>
              <dt className="text-fade dark:text-zinc-400">{t("areaDeclared")}</dt>
              <dd className="font-mono text-ink dark:text-zinc-300">
                {formatArea(declaredAreaM2)}
              </dd>
            </>
          )}
        </dl>

        {/* Adrian's requirement, shown rather than promised. */}
        <div className="mt-4 rounded-md border border-wire bg-canvas p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
          {hasOwnNumbers && (
            <>
              <p className="text-xs font-medium text-fade dark:text-zinc-400">
                {t("cornerNumbers")}
              </p>
              <p className="mt-1 font-mono text-sm text-ink dark:text-zinc-300">
                {beforeNumbers} <span aria-hidden="true">→</span> {afterNumbers}
              </p>
            </>
          )}
          <p className={hasOwnNumbers ? "mt-2 text-xs text-fade dark:text-zinc-400" : "text-xs text-fade dark:text-zinc-400"}>
            {hasOwnNumbers
              ? t("keepsNumbers", { moved: movedRows })
              : t("movedRows", { moved: movedRows })}
          </p>
        </div>

        <p className="mt-4 text-xs text-fade dark:text-zinc-400">{t("thenSave")}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
