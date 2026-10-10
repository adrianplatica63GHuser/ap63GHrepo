"use client";

/**
 * The relationship triangle — a tile above the lists of „Roluri și legături".      (Slice #38.62)
 *
 * An equilateral triangle whose corners are Persoană, Proprietate and Document. A corner's loop is a
 * link between two objects of the same kind; a side, a link between two kinds. Each of the six carries
 * a number, explained in the list beside the drawing: what the link is, where it is configured, and
 * whether it is configured at all — in words, never by colour alone (a link that is not configured is
 * also drawn dashed). A corner or side that has a list opens it (`?list=`, Ask first #2); Document –
 * Proprietate has none and opens nothing. The data is `RELATIONSHIPS` (`@/lib/admin/value-lists/relationships`).
 */

import { useId, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { LIST_META, type ListKey } from "@/lib/admin/value-lists/config";
import { RELATIONSHIPS, type ObjectKind, type Relationship } from "@/lib/admin/value-lists/relationships";
import { dialogCardStyle, rem } from "@/lib/ui/field-widths";

/**
 * THE DRAWING'S GEOMETRY.                                                     (Slices #38.62, #38.67)
 *
 * #38.67: about 20 % smaller — 334 px wide where #38.62's was 416 (a 440-unit viewBox drawn at 26rem).
 * Scaling that viewBox down would have taken the words under 12 px (the numbers were already 11.3), so the
 * drawing is now one unit to one pixel and the GEOMETRY shrinks instead: the sides are 146 long (were 240),
 * the boxes 96 × 32 (were 104 × 34), and the text keeps its size — the objects' names 13 px (13.2 before),
 * the numbers 12 px. „Proprietate", the longest name, is 68.6 px at 13 px bold, so a box keeps 13 px a side.
 * Every coordinate below comes from these few numbers; the 1-unit margin keeps the outer numbers' rims
 * inside the viewBox.
 */
const SIDE = 146;
const BOX = { w: 96, h: 32 };
/** A number's bubble. */
const BUBBLE = 11;
/** How far a corner's number sits from its box — on the loop, outward from the triangle. */
const LOOP_REACH = 34;
const MARGIN = 1;
const LEFT = MARGIN + BUBBLE + LOOP_REACH + BOX.w / 2; //   Proprietate's centre: 94
const TOP = MARGIN + BUBBLE + 36 + BOX.h / 2; //             Persoană's centre: 64 — its number 36 above its box
const BASE = Math.round(TOP + (SIDE * Math.sqrt(3)) / 2); // Proprietate's and Document's: 190
export const DRAWING = { w: LEFT * 2 + SIDE, h: BASE + BOX.h / 2 + MARGIN }; // 334 × 207

/** Where each object sits — the triangle's corners. */
const AT: Record<ObjectKind, { x: number; y: number }> = {
  person: { x: LEFT + SIDE / 2, y: TOP },
  property: { x: LEFT, y: BASE },
  document: { x: LEFT + SIDE, y: BASE },
};

/**
 * A corner's loop: a curve that leaves the object's box and comes back to it, outward from the
 * triangle — above Persoană, left of Proprietate, right of Document — and where its number sits.
 */
const LOOP: Record<ObjectKind, { d: string; nx: number; ny: number }> = (() => {
  const p = AT.person;
  const top = p.y - BOX.h / 2;
  const side = (k: "property" | "document", dir: -1 | 1) => {
    const c = AT[k];
    const edge = c.x + (dir * BOX.w) / 2;
    return {
      d: `M ${edge} ${c.y - 12} C ${edge + dir * 48} ${c.y - 34}, ${edge + dir * 48} ${c.y + 34}, ${edge} ${c.y + 12}`,
      nx: edge + dir * LOOP_REACH,
      ny: c.y,
    };
  };
  return {
    person: { d: `M ${p.x - 14} ${top} C ${p.x - 34} ${top - 49}, ${p.x + 34} ${top - 49}, ${p.x + 14} ${top}`, nx: p.x, ny: top - 36 },
    property: side("property", -1),
    document: side("document", 1),
  };
})();

/** Where a relationship's number sits: on its corner's loop, or halfway along its side. */
function numberAt(r: Relationship): { x: number; y: number } {
  const [a, b] = r.ends;
  if (a === b) return { x: LOOP[a].nx, y: LOOP[a].ny };
  return { x: (AT[a].x + AT[b].x) / 2, y: (AT[a].y + AT[b].y) / 2 };
}

export function RelationshipTriangle({
  current,
  onOpen,
  cardUnits,
}: {
  /** The list open beside the categories — its relationships are drawn heavier. */
  current: ListKey;
  onOpen: (key: ListKey) => void;
  /** The list card's width, so the tile above it lines up with it. */
  cardUnits: number;
}) {
  const t = useTranslations("valueList");
  const titleId = useId();
  const svgTitleId = useId();
  const listName = (key: ListKey) => t(`lists.${LIST_META[key].titleKey}`);
  const name = (r: Relationship) => t(`triangle.relations.${r.id}.name`);
  const openLabel = (r: Relationship) => (r.list ? t("triangle.open", { name: name(r), list: listName(r.list) }) : name(r));

  function press(e: MouseEvent, key: ListKey) {
    e.preventDefault();
    onOpen(key);
  }

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      data-relationship-triangle=""
      className="@container rounded-xl border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      style={dialogCardStyle(cardUnits)}
    >
      {/* Slice #38.67: the title and its sentence over the drawing, in a column as wide as the drawing; the six beside
          them from the tile's top edge, a divider between that runs the tile's full height. #38.62's full-width
          divider under the title is gone. Where the tile cannot hold both side by side (under 42rem: the column's
          23.4rem and the six's 18rem), the six go under the column and the divider turns horizontal. */}
      <div className="flex flex-col @min-[42rem]:flex-row">
        <div className="flex shrink-0 flex-col gap-4 px-5 py-4" data-triangle-column="">
          <div style={{ width: rem(DRAWING.w / 16) }} data-triangle-heading="">
            <h2 id={titleId} className="text-base font-semibold text-ink dark:text-zinc-100">
              {t("triangle.title")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-fade dark:text-zinc-400">{t("triangle.intro")}</p>
          </div>

          <svg
            viewBox={`0 0 ${DRAWING.w} ${DRAWING.h}`}
            role="img"
            aria-labelledby={svgTitleId}
            className="max-w-full shrink-0 text-ink dark:text-zinc-300"
            style={{ width: rem(DRAWING.w / 16) }}
            data-triangle-drawing=""
          >
            <title id={svgTitleId}>{t("triangle.drawing")}</title>

            {/* The three sides — a side that is not configured is dashed, so the drawing says it without colour. */}
            {RELATIONSHIPS.filter((r) => r.ends[0] !== r.ends[1]).map((r) => {
              const [a, b] = r.ends;
              return (
                <line
                  key={r.id}
                  x1={AT[a].x}
                  y1={AT[a].y}
                  x2={AT[b].x}
                  y2={AT[b].y}
                  stroke="currentColor"
                  strokeWidth={r.list === current ? 3 : 1.5}
                  strokeDasharray={r.configured ? undefined : "6 5"}
                  data-side={r.id}
                />
              );
            })}

            {/* The three corners' loops — a link between two objects of the same kind. */}
            {RELATIONSHIPS.filter((r) => r.ends[0] === r.ends[1]).map((r) => (
              <path
                key={r.id}
                d={LOOP[r.ends[0]].d}
                fill="none"
                stroke="currentColor"
                strokeWidth={r.list === current ? 3 : 1.5}
                data-corner={r.id}
              />
            ))}

            {/* The three objects, over the lines. */}
            {(Object.keys(AT) as ObjectKind[]).map((k) => (
              <g key={k} data-object={k}>
                <rect
                  x={AT[k].x - BOX.w / 2}
                  y={AT[k].y - BOX.h / 2}
                  width={BOX.w}
                  height={BOX.h}
                  rx={8}
                  className="fill-white dark:fill-zinc-900"
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
                <text x={AT[k].x} y={AT[k].y} textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize={13} fontWeight={600}>
                  {t(`triangle.objects.${k}`)}
                </text>
              </g>
            ))}

            {/* The six numbers — a link where the relationship has a list (Ask first #2). */}
            {RELATIONSHIPS.map((r, i) => {
              const at = numberAt(r);
              const mark = (
                <>
                  <circle cx={at.x} cy={at.y} r={BUBBLE} className="fill-white dark:fill-zinc-900" stroke="currentColor" strokeWidth={1.5} />
                  <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize={12} fontWeight={600}>
                    {i + 1}
                  </text>
                </>
              );
              return r.list ? (
                <a
                  key={r.id}
                  href={`/admin/value-lists?list=${r.list}`}
                  onClick={(e) => press(e, r.list as ListKey)}
                  aria-label={openLabel(r)}
                  data-relationship={r.id}
                  className="cursor-pointer focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <title>{openLabel(r)}</title>
                  {mark}
                </a>
              ) : (
                <g key={r.id} data-relationship={r.id} aria-label={name(r)}>
                  <title>{name(r)}</title>
                  {mark}
                </g>
              );
            })}
          </svg>
        </div>

        <ol
          className="flex min-w-[18rem] flex-1 flex-col gap-3 border-t border-card-rim px-5 pt-4 pb-5 dark:border-zinc-800 @min-[42rem]:border-t-0 @min-[42rem]:border-l @min-[42rem]:pt-1.5"
          data-triangle-list=""
        >
          {RELATIONSHIPS.map((r, i) => (
            <li key={r.id} className="flex gap-3" data-relationship-entry={r.id} data-configured={r.configured ? "yes" : "no"}>
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink text-xs font-semibold text-ink dark:border-zinc-300 dark:text-zinc-300"
              >
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="sr-only">{i + 1}.</span>
                  {r.list ? (
                    <a
                      href={`/admin/value-lists?list=${r.list}`}
                      onClick={(e) => press(e, r.list as ListKey)}
                      title={openLabel(r)}
                      className="font-semibold text-cta underline decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-focus dark:text-sky-300"
                    >
                      {name(r)}
                    </a>
                  ) : (
                    <span className="font-semibold text-ink dark:text-zinc-100">{name(r)}</span>
                  )}
                  <span className="text-xs font-medium text-fade dark:text-zinc-400" data-status="">
                    {t(r.configured ? "triangle.status.configured" : "triangle.status.notConfigured")}
                  </span>
                </div>
                <p className="leading-relaxed text-ink dark:text-zinc-300">{t(`triangle.relations.${r.id}.text`)}</p>
                <p className="text-xs leading-relaxed text-fade dark:text-zinc-400">{t(`triangle.relations.${r.id}.where`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
