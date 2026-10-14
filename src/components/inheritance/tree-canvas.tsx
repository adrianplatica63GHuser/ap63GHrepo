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
 *
 * #39.13, time and documents (`docs`, `year`, `shared`): from the middle level each person with documents carries a
 * badge with how many, which opens the list of them — type, number, date — each opening the document through the
 * guarded navigation, as „Interacțiuni"'s paperclip does (#38.84). A `year` fades whoever was born after it, and the
 * lines to them. `shared` — „Acte comune", off unless asked — puts on the line between two related persons how many
 * documents both are on, which opens the same list for the pair.
 */
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, FileText, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { runPath } from "@/lib/inheritance/placement";
import {
  MAX_SCALE,
  MIN_SCALE,
  SLOT_W,
  birthDate,
  birthYear,
  deathDate,
  lifeYears,
  levelAt,
  shortName,
  tieAlong,
  type FamilyRun,
  type TreeEdge,
  type TreeLayout,
  type TreeLevel,
  type TreePerson,
  type TreeTie,
} from "@/lib/inheritance/layout";
import { personTreeHref } from "@/lib/inheritance/links";
import {
  bornAfter,
  diedBy,
  documentDay,
  documentsOf,
  pairKey,
  sharedDocuments,
  type DocumentIndex,
  type TreeAppearance,
  type TreeDocument,
} from "@/lib/inheritance/documents";
import { roleHeldBy, personRoleShown } from "@/lib/persons/relation-roles";
import { DECEASED_MARK } from "@/lib/persons/person-age";

export type TreeData = { persons: TreePerson[]; ties: TreeTie[]; documents?: TreeDocument[]; appearances?: TreeAppearance[] };
/** Centre on a person: a new `n` asks again for the same person. */
export type TreeFocus = { id: string; n: number } | null;
type View = { scale: number; tx: number; ty: number };
/** Whose documents are listed: one person's, or the ones a related pair shares. */
type DocsOpen = { kind: "person"; id: string } | { kind: "pair"; a: string; b: string } | null;

const NODE_W = SLOT_W - 24;
const INK = "#1e3a8a";
const LINE = "#64748b";
const DOCS = "#0f766e";
/** How much of a person born after the chosen year is left: enough to see where they will stand. */
const FADED = 0.15;

export function TreeCanvas({
  data,
  layout,
  focus = null,
  withCard = false,
  linkOf = personTreeHref,
  mark = null,
  onLevel,
  docs = null,
  year = null,
  shared = false,
  // Positions the canvas: `relative` on its own, `absolute inset-0` to fill a frame. Never both — `relative` wins
  // in the stylesheet, the box falls to 0 px high and the side card is clipped under its parent (#39.12).
  className = "relative",
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
  /** #39.13: the documents each person is on — a badge from the middle level. */
  docs?: DocumentIndex | null;
  /** #39.13: whoever was born after this year fades; null is today. */
  year?: number | null;
  /** #39.13: „Acte comune" — on each line, how many documents the two are both on. */
  shared?: boolean;
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
  const [docsOpen, setDocsOpen] = useState<DocsOpen>(null);
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
    if (!view || (e.target as Element).closest("a,[data-tree-node],[data-tree-shared],button,input,aside")) return;
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
    if (drag.current && !drag.current.moved) {
      setChosen(null);
      setDocsOpen(null);
    }
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

  // #39.13: who is faded at the chosen year, and — „Acte comune" — each related pair's shared documents.
  const faded = useMemo(() => new Set(data.persons.filter((p) => bornAfter(p, year)).map((p) => p.id)), [data.persons, year]);
  // Slice #39.30: who is dead at the chosen year — „†" after the name and „1921–1998" under it.
  const dead = useMemo(() => new Set(data.persons.filter((p) => diedBy(p, year)).map((p) => p.id)), [data.persons, year]);
  const pairs = useMemo(() => {
    if (!shared || !docs) return [];
    const seen = new Map<string, { key: string; a: string; b: string; count: number }>();
    for (const e of layout.edges) {
      const [a, b] = e.kind === "parent" ? [e.parent, e.child] : [e.a, e.b];
      const key = pairKey(a, b);
      if (seen.has(key)) continue;
      const count = sharedDocuments(docs, a, b).length;
      if (count > 0) seen.set(key, { key, a, b, count });
    }
    return [...seen.values()];
  }, [shared, docs, layout.edges]);
  const listed: TreeDocument[] = !docs || !docsOpen ? [] : docsOpen.kind === "person" ? documentsOf(docs, docsOpen.id) : sharedDocuments(docs, docsOpen.a, docsOpen.b);
  const listTitle = !docsOpen
    ? ""
    : docsOpen.kind === "person"
      ? t("docs.title", { name: byId.get(docsOpen.id)?.displayName ?? "" })
      : t("docs.sharedTitle", { a: byId.get(docsOpen.a)?.displayName ?? "", b: byId.get(docsOpen.b)?.displayName ?? "" });

  return (
    <div
      ref={boxRef}
      className={`min-h-0 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing ${className}`}
      data-tree-level={level}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {view && layout.nodes.length > 0 && (
        <svg className="absolute inset-0 h-full w-full" role="img" aria-label={t("title")}>
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
            <Lines edges={layout.edges} runs={layout.runs} at={at} strokeWidth={px(1.5)} faded={faded} />
            {layout.nodes.map((n) => {
              const p = byId.get(n.id)!;
              return (
                <g
                  key={n.id}
                  data-tree-node={n.id}
                  data-generation={n.generation}
                  data-cluster={n.cluster}
                  transform={`translate(${n.x} ${n.y})`}
                  opacity={faded.has(n.id) ? FADED : 1}
                  data-tree-faded={faded.has(n.id) ? "" : undefined}
                  data-tree-dead={dead.has(n.id) ? "" : undefined}
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
                    dead={dead.has(n.id)}
                    level={level}
                    px={px}
                    ring={found === n.id || chosen === n.id || mark === n.id}
                    ties={level === 3 ? tiesOf(n.id) : []}
                    byId={byId}
                    href={linkOf(n.id)}
                    onOpen={open}
                    docCount={docs ? (docs.byPerson.get(n.id)?.length ?? 0) : 0}
                    onDocs={() => setDocsOpen({ kind: "person", id: n.id })}
                  />
                </g>
              );
            })}
            {/* „Acte comune": a pair's count, halfway along the line between them. */}
            {pairs.map(({ key, a, b, count }) => {
              const [pa, pb] = [at.get(a), at.get(b)];
              if (!pa || !pb) return null;
              const label = t("docs.shared", { count });
              return (
                <g
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  data-tree-shared={key}
                  transform={`translate(${(pa.x + pb.x) / 2} ${(pa.y + pb.y) / 2})`}
                  opacity={faded.has(a) || faded.has(b) ? FADED : 1}
                  onClick={() => setDocsOpen({ kind: "pair", a, b })}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    setDocsOpen({ kind: "pair", a, b });
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <title>{label}</title>
                  <rect x={px(-13)} y={px(-10)} width={px(26)} height={px(20)} rx={px(10)} fill="#ffffff" stroke={DOCS} strokeWidth={px(2)} />
                  <text textAnchor="middle" y={px(4)} fontSize={px(11)} fontWeight={700} fill={DOCS} data-tree-shared-count="">
                    {count}
                  </text>
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
          <div className="font-semibold text-ink dark:text-zinc-100">
            {byId.get(hover)!.displayName}
            {dead.has(hover) && <span title={t("deceased")}> {DECEASED_MARK}</span>}
          </div>
          {birthDate(byId.get(hover)!) && <div className="text-fade">{t("born", { date: birthDate(byId.get(hover)!)! })}</div>}
          {dead.has(hover) && <div className="text-fade">{deathDate(byId.get(hover)!) ? t("died", { date: deathDate(byId.get(hover)!)! }) : t("deceased")}</div>}
          <div className="text-fade">{t("ties", { count: tiesOf(hover).length })}</div>
          {docs && <div className="text-fade">{t("docs.count", { count: docs.byPerson.get(hover)?.length ?? 0 })}</div>}
        </div>
      )}

      {/* #39.13: the documents of a person or a pair — type, number, date — each opening through the guard. */}
      {docsOpen && listed.length > 0 && (
        <aside
          className="absolute left-2 top-2 z-30 flex max-h-[calc(100%-1rem)] w-72 max-w-[calc(100%-1rem)] flex-col gap-2 overflow-y-auto rounded-lg border border-card-rim bg-white p-3 text-sm shadow-xl dark:border-zinc-600 dark:bg-zinc-800"
          aria-label={listTitle}
          data-tree-docs=""
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-ink dark:text-zinc-100">{listTitle}</p>
            <IconButton icon={X} label={t("closeCard")} variant="secondary" size="xs" onClick={() => setDocsOpen(null)} />
          </div>
          <ul className="flex flex-col gap-1">
            {listed.map((d) => {
              const facts = [d.number ? t("docs.number", { number: d.number }) : null, documentDay(d.date) ? t("docs.date", { date: documentDay(d.date)! }) : null]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => guardedNavigate(`/documents/${encodeURIComponent(d.id)}`)}
                    className="flex w-full items-start gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-sky-50 hover:underline dark:hover:bg-zinc-700"
                    data-tree-doc={d.id}
                  >
                    <FileText aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-teal-700" />
                    <span className="flex flex-col">
                      <span className="text-cta">{d.type ?? t("docs.untyped")}</span>
                      {facts && <span className="text-fade">{facts}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
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
              {dead.has(chosen) && <span title={t("deceased")}> {DECEASED_MARK}</span>}
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
            {dead.has(chosen) && (
              <>
                <dt className="text-fade">{t("death")}</dt>
                <dd data-tree-card-death="">{deathDate(byId.get(chosen)!) ?? t("deceased")}</dd>
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

/** The lines: each family's from its parents — from between the two when they are a couple — down its own lane
 *  to each child, every turn rounded (#39.34, `runPath`); and couples, siblings with no parent drawn and other
 *  relatives (dashed) side by side. */
function Lines({
  edges,
  runs,
  at,
  strokeWidth,
  faded,
}: {
  edges: TreeEdge[];
  runs: FamilyRun[];
  at: Map<string, { x: number; y: number }>;
  strokeWidth: number;
  /** #39.13: a line to someone not yet born fades with them. */
  faded: ReadonlySet<string>;
}) {
  const parentsOf = new Map<string, string[]>();
  for (const e of edges) if (e.kind === "parent") parentsOf.set(e.child, [...(parentsOf.get(e.child) ?? []), e.parent]);
  const paths: { key: string; d: string; dashed?: boolean; thick?: boolean; dim?: boolean; run?: string }[] = [];
  for (const run of runs) {
    for (const c of run.children) {
      paths.push({ key: `p-${run.key}-${c.id}`, d: runPath(run.from, run.laneY, c), dim: faded.has(c.id), run: run.key });
    }
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
    paths.push({ key: `${e.kind}-${e.tieId}`, d, dashed: e.kind === "other", thick: e.kind === "spouse", dim: faded.has(e.a) || faded.has(e.b) });
  }
  return (
    <g fill="none" stroke={LINE} data-tree-lines="">
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          strokeWidth={p.thick ? strokeWidth * 2 : strokeWidth}
          strokeDasharray={p.dashed ? `${strokeWidth * 4} ${strokeWidth * 3}` : undefined}
          opacity={p.dim ? FADED : 1}
          data-tree-run={p.run}
        />
      ))}
    </g>
  );
}

/** One node, as its level allows: far — a dot and a short name; middle — a card with the name and the year; near —
 *  the date, the gender and the roles. Sizes are on-screen pixels (`px`), so the text reads the same at every zoom. */
function Node({
  person,
  dead,
  level,
  px,
  ring,
  ties,
  byId,
  href,
  onOpen,
  docCount,
  onDocs,
}: {
  person: TreePerson;
  /** Slice #39.30: dead at the slider's year — „†" after the name, „1921–1998" under it. */
  dead: boolean;
  level: TreeLevel;
  px: (n: number) => number;
  ring: boolean;
  ties: { other: string; word: string }[];
  byId: Map<string, TreePerson>;
  href: string;
  onOpen: (id: string) => (e: React.MouseEvent) => void;
  /** #39.13: how many documents the person is on — a badge from the middle level, which lists them. */
  docCount: number;
  onDocs: () => void;
}) {
  const t = useTranslations("inheritance");
  const fill = person.gender === "FEMALE" ? "#fdf2f8" : person.gender === "MALE" ? "#eff6ff" : "#f8fafc";
  if (level === 1) {
    return (
      <>
        {ring && <circle r={px(14)} fill="none" stroke="#f59e0b" strokeWidth={px(3)} />}
        <circle r={px(7)} fill={INK} />
        <text y={px(22)} textAnchor="middle" fontSize={px(12)} fill={INK} data-tree-label="">
          {dead ? `${shortName(person)} ${DECEASED_MARK}` : shortName(person)}
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
    // Slice #39.30: the dead read „1921–1998" — the genealogist's span — instead of „n. 1921".
    if (dead) lines.push(lifeYears(person)!);
    else if (y) lines.push(t("bornYear", { year: y }));
  } else {
    const d = birthDate(person);
    const g = person.gender ? t(`genders.${person.gender}`) : null;
    const facts = [d ? t("born", { date: d }) : null, g].filter(Boolean).join(" · ");
    if (facts) lines.push(facts);
    if (dead) lines.push(deathDate(person) ? `${lifeYears(person)} · ${t("died", { date: deathDate(person)! })}` : lifeYears(person)!);
    // #39.34: „Fiică pentru: Bogdan Dumitrescu" — the other's name as their own box heads it, cut to fit (the
    // whole line in the tooltip below).
    for (const tie of ties.slice(0, 3)) lines.push(t("tieFor", { role: tie.word, name: byId.get(tie.other)!.displayName }));
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
          {dead ? `${fit(person.displayName, 13)} ${DECEASED_MARK}` : fit(person.displayName, 13)}
        </text>
      </a>
      {lines.map((l, i) => (
        <text key={i} x={0} y={-h / 2 + px(17) + (i + 1) * lineH} textAnchor="middle" fontSize={px(11)} fill="#475569" data-tree-line="">
          {/* #39.34 (Ask first 3): a line cut with „…" is whole in its tooltip; the box does not grow. */}
          {fit(l, 11) !== l && <title>{l}</title>}
          {fit(l, 11)}
        </text>
      ))}
      {docCount > 0 && (
        <g
          role="button"
          tabIndex={0}
          aria-label={t("docs.badge", { count: docCount })}
          data-tree-docs-badge=""
          transform={`translate(${NODE_W / 2 - px(2)} ${-h / 2 + px(2)})`}
          onClick={(e) => {
            e.stopPropagation();
            onDocs();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            e.stopPropagation();
            onDocs();
          }}
        >
          <title>{t("docs.badge", { count: docCount })}</title>
          <circle r={px(10)} fill={DOCS} stroke="#ffffff" strokeWidth={px(1.5)} />
          <text textAnchor="middle" y={px(4)} fontSize={px(11)} fontWeight={700} fill="#ffffff" data-tree-docs-count="">
            {docCount}
          </text>
        </g>
      )}
    </>
  );
}
