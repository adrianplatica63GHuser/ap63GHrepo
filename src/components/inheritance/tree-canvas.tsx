"use client";

/**
 * The inheritance tree, drawn — shared by the whole tree (A, #39.11) and a person's tile (B, #39.12).
 *
 * Every person given is a node and every tie a line (`layoutTree`). THREE LEVELS, by the zoom: far — a dot and a
 * short name; middle — the full name and the birth year; near — the birth date, the gender and the person's role
 * towards each neighbour. The mouse wheel zooms about the cursor, as on a document's page; a drag pans. The text keeps
 * its size on screen at every zoom; what changes is how much of it there is room for.
 *
 * Hover a node: a small card — name, birth date, how many family ties. Click it: on the whole tree a side card with
 * the person's name, nickname, gender, birth date and ties, and „Deschide" (`withCard`); on a tile, a ring. Every name
 * is a link: in the whole tree to the person's screen with the tree's action panel open (`personTreeHref`, #39.12).
 * ⚠️ No CNP, no identity-card field and no address, at any level: the route does not even send them.
 */
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import {
  MAX_SCALE,
  MIN_SCALE,
  ROW_H,
  SLOT_W,
  birthDate,
  birthYear,
  levelAt,
  shortName,
  tieAlong,
  type TreeEdge,
  type TreeLayout,
  type TreeLevel,
  type TreePerson,
  type TreeTie,
} from "@/lib/inheritance/layout";
import { personTreeHref } from "@/lib/inheritance/links";
import { roleHeldBy, personRoleShown } from "@/lib/persons/relation-roles";

export type TreeData = { persons: TreePerson[]; ties: TreeTie[] };
/** Centre on a person: a new `n` asks again for the same person. */
export type TreeFocus = { id: string; n: number } | null;
type View = { scale: number; tx: number; ty: number };

const NODE_W = SLOT_W - 24;
const INK = "#1e3a8a";
const LINE = "#64748b";

export function TreeCanvas({
  data,
  layout,
  focus = null,
  withCard = false,
  linkOf = personTreeHref,
  mark = null,
  onLevel,
  className = "",
}: {
  data: TreeData;
  layout: TreeLayout;
  focus?: TreeFocus;
  /** The whole tree's side card on a click; a tile only rings the node. */
  withCard?: boolean;
  /** Where a name goes. */
  linkOf?: (id: string) => string;
  /** A person drawn in amber — the tile's own person. */
  mark?: string | null;
  onLevel?: (level: TreeLevel) => void;
  className?: string;
}) {
  const t = useTranslations("inheritance");
  const { guardedNavigate } = useUnsavedChanges();
  const byId = useMemo(() => new Map(data.persons.map((p) => [p.id, p])), [data.persons]);
  const tieById = useMemo(() => new Map(data.ties.map((x) => [x.id, x])), [data.ties]);
  const at = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);

  const boxRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [found, setFound] = useState<string | null>(null);
  const level: TreeLevel = levelAt(view?.scale ?? 1);
  useEffect(() => onLevel?.(level), [level, onLevel]);

  // ── The first view: the whole drawing, fitted ──────────────────────────────
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || view !== null || layout.nodes.length === 0) return;
    const { width: W, height: H } = box.getBoundingClientRect();
    const scale = Math.min(1, Math.max(MIN_SCALE, Math.min((W - 40) / layout.width, (H - 40) / layout.height)));
    setView({ scale, tx: (W - layout.width * scale) / 2, ty: Math.max(12, (H - layout.height * scale) / 2) });
  }, [layout, view]);

  // ── The wheel zooms about the cursor (a native listener: React's is passive) ─────
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = box.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setView((v) => {
        if (!v) return v;
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * Math.exp(-e.deltaY * 0.0015)));
        const k = scale / v.scale;
        return { scale, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k };
      });
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, []);

  // ── A drag pans ─────────────────────────────────────────────────────────────
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!view || (e.target as Element).closest("a,[data-tree-node],button,input,aside")) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setView((v) => (v ? { ...v, tx: d.tx + dx, ty: d.ty + dy } : v));
  };
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) setChosen(null);
    drag.current = null;
  };

  // A focus asked from outside (the search, the address): centred once per request, near enough to read (level 3),
  // the person ringed for three seconds — and, on the whole tree, their card opened.
  const lastFocus = useRef<TreeFocus>(null);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!focus || !box || view === null) return;
    if (lastFocus.current && lastFocus.current.n === focus.n && lastFocus.current.id === focus.id) return;
    const n = at.get(focus.id);
    if (!n) return;
    lastFocus.current = focus;
    const { width: W, height: H } = box.getBoundingClientRect();
    setView({ scale: 1.3, tx: W / 2 - n.x * 1.3, ty: H / 2 - n.y * 1.3 });
    setFound(focus.id);
    if (withCard) setChosen(focus.id);
  }, [focus, view, at, withCard]);
  useEffect(() => {
    if (found === null) return;
    const timer = setTimeout(() => setFound(null), 3000);
    return () => clearTimeout(timer);
  }, [found]);

  const open = (id: string) => (e: React.MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    guardedNavigate(linkOf(id));
  };

  /** Each tie of `id`: the other person and what `id` is to them — the role's own word, read from `id`'s end. */
  const tiesOf = (id: string) =>
    layout.edges
      .filter((e) => (e.kind === "parent" ? e.parent === id || e.child === id : e.a === id || e.b === id))
      .map((e) => {
        const other = e.kind === "parent" ? (e.parent === id ? e.child : e.parent) : e.a === id ? e.b : e.a;
        const tie = tieById.get(e.tieId)!;
        const holds = roleHeldBy(id, tie.personIdA, tie.roleReadsAToB);
        const shown = personRoleShown(tie.role, holds, byId.get(id)?.gender ?? null);
        const word = shown.kind === "role" ? shown.name : t(`kinship.${tieAlong(e, id)}`);
        return { other, word, edge: e };
      });

  const s = view?.scale ?? 1;
  const px = (n: number) => n / s; // a size on screen, in the drawing's units

  return (
    <div
      ref={boxRef}
      className={`relative min-h-0 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing ${className}`}
      data-tree-level={level}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {view && layout.nodes.length > 0 && (
        <svg className="absolute inset-0 h-full w-full" role="img" aria-label={t("title")}>
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
            <Lines edges={layout.edges} at={at} strokeWidth={px(1.5)} />
            {layout.nodes.map((n) => {
              const p = byId.get(n.id)!;
              return (
                <g
                  key={n.id}
                  data-tree-node={n.id}
                  data-generation={n.generation}
                  data-cluster={n.cluster}
                  transform={`translate(${n.x} ${n.y})`}
                  onPointerEnter={() => setHover(n.id)}
                  onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
                  onClick={(e) => {
                    if ((e.target as Element).closest("a")) return;
                    setChosen(n.id);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <Node
                    person={p}
                    level={level}
                    px={px}
                    ring={found === n.id || chosen === n.id || mark === n.id}
                    ties={level === 3 ? tiesOf(n.id) : []}
                    byId={byId}
                    href={linkOf(n.id)}
                    onOpen={open}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {/* The hover card: name, birth date, how many family ties. */}
      {hover && view && at.get(hover) && hover !== chosen && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-card-rim bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-600 dark:bg-zinc-800"
          style={{ left: at.get(hover)!.x * view.scale + view.tx + 14, top: at.get(hover)!.y * view.scale + view.ty + 14 }}
          data-tree-hover=""
        >
          <div className="font-semibold text-ink dark:text-zinc-100">{byId.get(hover)!.displayName}</div>
          {birthDate(byId.get(hover)!) && <div className="text-fade">{t("born", { date: birthDate(byId.get(hover)!)! })}</div>}
          <div className="text-fade">{t("ties", { count: tiesOf(hover).length })}</div>
        </div>
      )}

      {/* The side card: the person's main fields, read-only, and „Deschide". */}
      {withCard && chosen && byId.get(chosen) && (
        <aside
          className="absolute right-4 top-4 z-20 flex w-80 flex-col gap-2 rounded-lg border border-card-rim bg-white p-4 text-sm shadow-xl dark:border-zinc-600 dark:bg-zinc-800"
          aria-label={byId.get(chosen)!.displayName}
          data-tree-card=""
        >
          <div className="flex items-start justify-between gap-2">
            <Link href={linkOf(chosen)} onClick={open(chosen)} className="font-semibold text-cta hover:underline" data-tree-name-link="">
              {byId.get(chosen)!.displayName}
            </Link>
            <IconButton icon={X} label={t("closeCard")} variant="secondary" size="xs" onClick={() => setChosen(null)} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {byId.get(chosen)!.nickname && (
              <>
                <dt className="text-fade">{t("nickname")}</dt>
                <dd>{byId.get(chosen)!.nickname}</dd>
              </>
            )}
            {byId.get(chosen)!.gender && (
              <>
                <dt className="text-fade">{t("gender")}</dt>
                <dd>{t(`genders.${byId.get(chosen)!.gender!}`)}</dd>
              </>
            )}
            {birthDate(byId.get(chosen)!) && (
              <>
                <dt className="text-fade">{t("birth")}</dt>
                <dd>{birthDate(byId.get(chosen)!)}</dd>
              </>
            )}
          </dl>
          <ul className="flex flex-col gap-1 border-t border-crease pt-2 text-xs dark:border-zinc-700">
            {tiesOf(chosen).map(({ other, word, edge }) => (
              <li key={edge.tieId} className="flex gap-1">
                <span className="text-fade">{word} —</span>
                <Link href={linkOf(other)} onClick={open(other)} className="text-cta hover:underline">
                  {byId.get(other)?.displayName}
                </Link>
              </li>
            ))}
          </ul>
          <IconButton href={linkOf(chosen)} icon={ArrowRight} label={t("open")} showLabel variant="secondary" size="sm" onClick={open(chosen)} />
        </aside>
      )}
    </div>
  );
}

/** The lines: a parent's down to the child — from between the two when both parents are a couple — and couples,
 *  siblings with no parent drawn and other relatives (dashed) side by side. */
function Lines({ edges, at, strokeWidth }: { edges: TreeEdge[]; at: Map<string, { x: number; y: number }>; strokeWidth: number }) {
  const spouses = new Set(edges.flatMap((e) => (e.kind === "spouse" ? [[e.a, e.b].sort().join("|")] : [])));
  const parentsOf = new Map<string, string[]>();
  for (const e of edges) if (e.kind === "parent") parentsOf.set(e.child, [...(parentsOf.get(e.child) ?? []), e.parent]);
  const paths: { key: string; d: string; dashed?: boolean; thick?: boolean }[] = [];
  for (const [child, parents] of parentsOf) {
    const c = at.get(child)!;
    const couple = parents.length === 2 && spouses.has([...parents].sort().join("|"));
    const froms = couple ? [{ x: (at.get(parents[0]!)!.x + at.get(parents[1]!)!.x) / 2, y: at.get(parents[0]!)!.y }] : parents.map((p) => at.get(p)!);
    froms.forEach((f, i) => {
      const mid = f.y + ROW_H / 2;
      paths.push({ key: `p-${child}-${i}`, d: `M ${f.x} ${f.y} V ${mid} H ${c.x} V ${c.y}` });
    });
  }
  const shareParent = (a: string, b: string) => (parentsOf.get(a) ?? []).some((p) => (parentsOf.get(b) ?? []).includes(p));
  for (const e of edges) {
    if (e.kind === "parent") continue;
    if (e.kind === "sibling" && shareParent(e.a, e.b)) continue;
    const a = at.get(e.a)!;
    const b = at.get(e.b)!;
    const d = a.y === b.y && e.kind === "sibling"
      ? `M ${a.x} ${a.y - 30} Q ${(a.x + b.x) / 2} ${a.y - 70} ${b.x} ${b.y - 30}`
      : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    paths.push({ key: `${e.kind}-${e.tieId}`, d, dashed: e.kind === "other", thick: e.kind === "spouse" });
  }
  return (
    <g fill="none" stroke={LINE} data-tree-lines="">
      {paths.map((p) => (
        <path key={p.key} d={p.d} strokeWidth={p.thick ? strokeWidth * 2 : strokeWidth} strokeDasharray={p.dashed ? `${strokeWidth * 4} ${strokeWidth * 3}` : undefined} />
      ))}
    </g>
  );
}

/** One node, as its level allows: far — a dot and a short name; middle — a card with the name and the year; near —
 *  the date, the gender and the roles. Sizes are on-screen pixels (`px`), so the text reads the same at every zoom. */
function Node({
  person,
  level,
  px,
  ring,
  ties,
  byId,
  href,
  onOpen,
}: {
  person: TreePerson;
  level: TreeLevel;
  px: (n: number) => number;
  ring: boolean;
  ties: { other: string; word: string }[];
  byId: Map<string, TreePerson>;
  href: string;
  onOpen: (id: string) => (e: React.MouseEvent) => void;
}) {
  const t = useTranslations("inheritance");
  const fill = person.gender === "FEMALE" ? "#fdf2f8" : person.gender === "MALE" ? "#eff6ff" : "#f8fafc";
  if (level === 1) {
    return (
      <>
        {ring && <circle r={px(14)} fill="none" stroke="#f59e0b" strokeWidth={px(3)} />}
        <circle r={px(7)} fill={INK} />
        <text y={px(22)} textAnchor="middle" fontSize={px(12)} fill={INK} data-tree-label="">
          {shortName(person)}
        </text>
      </>
    );
  }
  // How many characters of a line fit the card at this zoom.
  const fit = (text: string, size: number) => {
    const max = Math.max(4, Math.floor(NODE_W / (px(size) * 0.58)));
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  };
  const lines: string[] = [];
  if (level === 2) {
    const y = birthYear(person);
    if (y) lines.push(t("bornYear", { year: y }));
  } else {
    const d = birthDate(person);
    const g = person.gender ? t(`genders.${person.gender}`) : null;
    const facts = [d ? t("born", { date: d }) : null, g].filter(Boolean).join(" · ");
    if (facts) lines.push(facts);
    for (const tie of ties.slice(0, 3)) lines.push(`${tie.word} — ${shortName(byId.get(tie.other)!)}`);
    if (ties.length > 3) lines.push(t("more", { count: ties.length - 3 }));
  }
  const lineH = px(16);
  const h = px(22) + lines.length * lineH + px(10);
  return (
    <>
      <rect
        x={-NODE_W / 2}
        y={-h / 2}
        width={NODE_W}
        height={h}
        rx={px(6)}
        fill={fill}
        stroke={ring ? "#f59e0b" : INK}
        strokeWidth={ring ? px(3) : px(1)}
      />
      <a href={href} onClick={onOpen(person.id)} data-tree-name-link="">
        <text x={0} y={-h / 2 + px(17)} textAnchor="middle" fontSize={px(13)} fontWeight={600} fill={INK} data-tree-label="">
          {fit(person.displayName, 13)}
        </text>
      </a>
      {lines.map((l, i) => (
        <text key={i} x={0} y={-h / 2 + px(17) + (i + 1) * lineH} textAnchor="middle" fontSize={px(11)} fill="#475569">
          {fit(l, 11)}
        </text>
      ))}
    </>
  );
}
