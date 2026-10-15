"use client";

/**
 * „Harta competențelor” — the skills diagram.                                                 (Slice #39.42)
 *
 * Every skill of src/lib/skills/catalogue.ts as a box, in four level columns, joined by straight arrows from
 * each predecessor (the layout: src/lib/skills/layout.ts). Each box keeps its level's colour and its name and
 * shows the signed-in user's state over them (src/lib/skills/appearance.ts), as 39.41's rules compute it from
 * the attempts (GET /api/account/skills-progress) — the drawing never decides a state.
 *
 *   - An Open box is a link to its quiz (/skills-map/<key>); any other box opens a small panel: what a Closed
 *     one still needs, when a Mastered or Obsolete one was mastered.
 *   - Hovering or focusing a box brings its own arrows forward and fades the rest.
 *   - The Paths are chips above the map: choosing one fades every skill outside it; a mastered Path's chip
 *     carries the green badge, and every box names its Path. Slice #39.50: a Path is everything it takes to
 *     reach its Expert skills, other Paths' skills included (src/lib/skills/paths.ts), and an arrow outside it
 *     is grey, its head as grey as its line.
 *   - Slice #39.50: two views. „Progresul meu” (the default) draws each box in the user's state; „Prezentare”
 *     draws every box as its level's colour, Open, with no badge and no grey — the map as it is meant, not as
 *     the user stands on it. Both follow the chosen Path, in the diagram and in „Listă”.
 *   - „Potrivește” fits the map to the window's width (the default), „100%” draws it at full size; the frame
 *     scrolls both ways. „Listă” shows the same skills as a list, by level.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Check, CircleCheck, List, Maximize2, Presentation, Waypoints, X, ZoomIn } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { SKILLS, SKILL_LEVELS, SKILL_PATHS, type Skill, type SkillLevel, type SkillPathKey } from "@/lib/skills/catalogue";
import { layoutSkills } from "@/lib/skills/layout";
import { boxAppearance, MASTERY_GREEN } from "@/lib/skills/appearance";
import { ARROW_GREY, ARROW_NAVY, arrowLook, inPath as pathHas, PATH_SKILLS } from "@/lib/skills/paths";
import type { SkillState } from "@/lib/skills/progress";
import { SectionList, type SectionLinkData } from "./section-list";

type SkillProgressDto = {
  key: string;
  state: SkillState;
  quizAvailable: boolean;
  retryAt: string | null;
  attempts: number;
  masteredAt: string | null;
};
type ProgressDto = { skills: SkillProgressDto[]; paths: Record<SkillPathKey, boolean> };

async function fetchProgress(): Promise<ProgressDto> {
  const res = await fetch("/api/account/skills-progress");
  if (!res.ok) throw new Error(`skills-progress ${res.status}`);
  return res.json();
}

const STATES: readonly SkillState[] = ["open", "mastered", "closed", "obsolete"];

/** The two ways of seeing the map (#39.50): the user's real progress, or the map as it is meant. */
type MapView = "progress" | "overview";

export function skillHref(key: string): string {
  return `/skills-map/${encodeURIComponent(key)}`;
}

/** The green mastery badge: a white tick in a green disc, on the box's top-right corner. */
function MasteryBadge({ small = false, className = "" }: { small?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-mastery-badge=""
      className={`inline-flex items-center justify-center rounded-full text-white ${small ? "h-4 w-4" : "h-6 w-6 shadow ring-2 ring-white"} ${className}`}
      style={{ background: MASTERY_GREEN }}
    >
      <Check size={small ? 11 : 15} strokeWidth={3} />
    </span>
  );
}

/** One box's face: the level's colour under a grey wash when greyed, the frame and the badge drawn on top. */
function BoxFace({ skill, name, state, pathLabel }: { skill: Pick<Skill, "level" | "number">; name: string; state: SkillState; pathLabel: string }) {
  const a = boxAppearance(skill.level, state);
  return (
    <>
      {/* A solid base, so no arrow shows through a greyed box; then the level's fill, greyed as a light wash of it. */}
      <span aria-hidden="true" className="absolute inset-0 rounded-lg bg-white" />
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-lg"
        style={{ background: a.fill, ...(a.greyed ? { filter: "grayscale(1)", opacity: 0.32 } : {}) }}
      />
      <span
        aria-hidden="true"
        className="relative flex h-full flex-col items-center justify-center gap-0.5 px-2 text-center leading-tight"
        style={{ color: a.textShown }}
      >
        <span className="text-sm font-bold">{skill.number}</span>
        <span className="line-clamp-2 text-[13px] font-semibold">{name}</span>
        <span className="text-[10px] uppercase tracking-wide opacity-80">{pathLabel}</span>
      </span>
      <span
        aria-hidden="true"
        data-frame={`${a.frameStyle}-${a.frameWidth}`}
        className="pointer-events-none absolute inset-0 rounded-lg"
        style={{ border: `${a.frameWidth}px ${a.frameStyle} ${a.frameColour}` }}
      />
      {a.badge && <MasteryBadge className="absolute -right-2.5 -top-2.5" />}
    </>
  );
}

export function SkillsMapView({ sections }: { sections: Readonly<Record<string, readonly SectionLinkData[]>> }) {
  const t = useTranslations("skillsMap");
  const locale = useLocale();
  const lang = locale === "en-GB" ? "en" : "ro";
  const layout = useMemo(() => layoutSkills(SKILLS), []);
  const progress = useQuery({ queryKey: ["skills-progress"], queryFn: fetchProgress });

  const [view, setView] = useState<"diagram" | "list">("diagram");
  const [zoom, setZoom] = useState<"fit" | "actual">("fit");
  const [path, setPath] = useState<SkillPathKey | null>(null);
  const [mode, setMode] = useState<MapView>("progress");
  const overview = mode === "overview";
  const [focused, setFocused] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // The frame's width, for „Potrivește”: measured when the frame mounts, and again whenever it resizes. Measuring
  // on mount matters — a ResizeObserver reports only on a drawn frame, and a tab in the background draws none.
  const [frameWidth, setFrameWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const frame = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setFrameWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setFrameWidth(el.clientWidth));
    ro.observe(el);
    observer.current = ro;
  }, []);

  const byKey = useMemo(() => new Map(SKILLS.map((s) => [s.key, s])), []);
  const stateOf = useMemo(() => {
    const m = new Map((progress.data?.skills ?? []).map((s) => [s.key, s]));
    return (key: string) => m.get(key);
  }, [progress.data]);

  const levelName = (l: SkillLevel) => SKILL_LEVELS.find((x) => x.level === l)!.name[lang];
  const pathName = (p: SkillPathKey) => SKILL_PATHS.find((x) => x.key === p)!.name[lang];
  const pathShort = (p: SkillPathKey) => t(`pathShort.${p}`);
  const stateName = (s: SkillState) => t(`states.${s}`);
  const label = (s: Skill, st: SkillState) =>
    overview
      ? t("boxLabelOverview", { number: s.number, name: s.name[lang], level: levelName(s.level), path: pathName(s.path) })
      : t("boxLabel", { number: s.number, name: s.name[lang], level: levelName(s.level), path: pathName(s.path), state: stateName(st) });
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" }).format(new Date(iso));

  // The frame's padding (p-4) is inside clientWidth.
  const scale = zoom === "fit" && frameWidth > 32 ? Math.min(1, (frameWidth - 32) / layout.width) : 1;
  const inPath = (key: string) => pathHas(key, path);
  const touches = (from: string, to: string) => focused === from || focused === to;

  const selectedSkill = selected ? byKey.get(selected) : undefined;
  const selectedProgress = selected ? stateOf(selected) : undefined;

  return (
    <div className="flex flex-col gap-4" data-skills-map>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-ink dark:text-zinc-100">{t("title")}</h1>
        <p className="max-w-3xl text-sm text-fade">{t("intro")}</p>
      </div>

      {/* Paths, the view and the zoom. */}
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={t("paths")}>
        <span className="text-xs font-semibold uppercase tracking-wide text-fade">{t("paths")}</span>
        <button
          type="button"
          aria-pressed={path === null}
          onClick={() => setPath(null)}
          className={`rounded-full border px-3 py-1 text-xs ${path === null ? "border-cta bg-cta-pale text-cta" : "border-card-rim text-ink dark:text-zinc-200"}`}
        >
          {t("allPaths")}
        </button>
        {SKILL_PATHS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={path === p.key}
            data-path-chip={p.key}
            onClick={() => setPath(path === p.key ? null : p.key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${path === p.key ? "border-cta bg-cta-pale text-cta" : "border-card-rim text-ink dark:text-zinc-200"}`}
          >
            {pathShort(p.key)}
            {!overview && progress.data?.paths[p.key] && (
              <>
                <MasteryBadge small />
                <span className="sr-only">{t("pathMastered")}</span>
              </>
            )}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1" role="group" aria-label={t("views")} data-map-views>
            <IconButton
              icon={CircleCheck}
              label={t("myProgress")}
              showLabel
              variant="secondary"
              size="sm"
              aria-pressed={!overview}
              data-map-view="progress"
              onClick={() => setMode("progress")}
            />
            <IconButton
              icon={Presentation}
              label={t("overview")}
              showLabel
              variant="secondary"
              size="sm"
              aria-pressed={overview}
              data-map-view="overview"
              onClick={() => {
                setMode("overview");
                setSelected(null);
              }}
            />
          </span>
          {view === "diagram" && (
            <>
              <IconButton icon={Maximize2} label={t("fit")} showLabel variant="secondary" size="sm" aria-pressed={zoom === "fit"} onClick={() => setZoom("fit")} />
              <IconButton icon={ZoomIn} label={t("actualSize")} showLabel variant="secondary" size="sm" aria-pressed={zoom === "actual"} onClick={() => setZoom("actual")} />
            </>
          )}
          {view === "diagram" ? (
            <IconButton icon={List} label={t("list")} showLabel variant="secondary" size="sm" onClick={() => setView("list")} />
          ) : (
            <IconButton icon={Waypoints} label={t("diagram")} showLabel variant="secondary" size="sm" onClick={() => setView("diagram")} />
          )}
        </span>
      </div>

      {path && (
        <p className="text-sm text-fade" data-path-note={path}>
          {t("pathNote", { path: pathName(path), count: PATH_SKILLS[path].size })}
        </p>
      )}

      {/* The legend: in „Progresul meu” the four states, on an Intermediate box; in „Prezentare” the four levels. */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-card-rim bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900" aria-label={t("legend")} role="group">
        {overview
          ? SKILL_LEVELS.map((lv) => (
              <div key={lv.level} className="flex items-center gap-2 text-xs text-ink dark:text-zinc-200" data-legend-level={lv.level}>
                <span className="relative block h-7 w-12 shrink-0">
                  <BoxFace skill={{ level: lv.level, number: "" }} name="" state="open" pathLabel="" />
                </span>
                <span className="font-semibold">{lv.name[lang]}</span>
              </div>
            ))
          : STATES.map((st) => (
              <div key={st} className="flex items-center gap-2 text-xs text-ink dark:text-zinc-200" data-legend={st}>
                <span className="relative block h-7 w-12 shrink-0">
                  <BoxFace skill={{ level: 2, number: "" }} name="" state={st} pathLabel="" />
                </span>
                <span>
                  <span className="font-semibold">{stateName(st)}</span> — {t(`stateHelp.${st}`)}
                </span>
              </div>
            ))}
        {overview && <p className="w-full text-xs text-fade" data-overview-note>{t("overviewNote")}</p>}
      </div>

      {progress.isPending && <p role="status" className="text-sm text-fade">{t("loading")}</p>}
      {progress.isError && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t("loadFailed")}</p>}

      {progress.isSuccess && view === "diagram" && (
        <div ref={frame} className="overflow-auto rounded-lg border border-card-rim bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950" data-skills-frame>
          <div style={{ width: layout.width * scale, height: layout.height * scale }} className="relative">
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: layout.width, height: layout.height, transform: `scale(${scale})` }}
              data-scale={scale.toFixed(3)}
            >
              {([1, 2, 3, 4] as const).map((l) => (
                <div key={l} className="absolute top-0 text-center" style={{ left: layout.columns[l], width: layout.boxes[0].width }}>
                  <div className="text-base font-bold uppercase tracking-wide text-ink dark:text-zinc-100">{levelName(l)}</div>
                  <div className="text-xs text-fade">{t("level", { level: l })}</div>
                </div>
              ))}

              <svg className="absolute inset-0" width={layout.width} height={layout.height} aria-hidden="true">
                <defs>
                  {/* One head per colour: a head is its line's colour, and the line's opacity covers it (#39.50). */}
                  <marker id="skills-arrow-navy" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill={ARROW_NAVY} />
                  </marker>
                  <marker id="skills-arrow-grey" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill={ARROW_GREY} />
                  </marker>
                </defs>
                {layout.arrows.map((a) => {
                  const look = arrowLook({ kept: inPath(a.from) && inPath(a.to), focused: focused !== null, lit: touches(a.from, a.to) });
                  return (
                    <line
                      key={`${a.from}>${a.to}`}
                      x1={a.x1}
                      y1={a.y1}
                      x2={a.x2 - 2}
                      y2={a.y2}
                      stroke={look.colour}
                      strokeWidth={look.width}
                      opacity={look.opacity}
                      markerEnd={`url(#skills-arrow-${look.head})`}
                      data-arrow={`${a.from}>${a.to}`}
                      data-arrow-head={look.head}
                    />
                  );
                })}
              </svg>

              {layout.boxes.map((b) => {
                const skill = byKey.get(b.key)!;
                const p = stateOf(b.key);
                const st: SkillState = p?.state ?? "closed";
                // „Prezentare” draws every box Open; the real state stays on data-state for anyone who asks.
                const shown: SkillState = overview ? "open" : st;
                const style = { left: b.x, top: b.y, width: b.width, height: b.height, opacity: inPath(b.key) ? 1 : 0.25 };
                const common = {
                  "aria-label": label(skill, st),
                  "data-skill": b.key,
                  "data-state": st,
                  "data-shown": shown,
                  onMouseEnter: () => setFocused(b.key),
                  onMouseLeave: () => setFocused(null),
                  onFocus: () => setFocused(b.key),
                  onBlur: () => setFocused(null),
                  className: "absolute block rounded-lg text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400",
                  style,
                };
                return st === "open" && !overview ? (
                  <Link key={b.key} href={skillHref(b.key)} {...common}>
                    <BoxFace skill={skill} name={skill.name[lang]} state={shown} pathLabel={pathShort(skill.path)} />
                  </Link>
                ) : (
                  <button key={b.key} type="button" onClick={() => setSelected(b.key)} {...common}>
                    <BoxFace skill={skill} name={skill.name[lang]} state={shown} pathLabel={pathShort(skill.path)} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {progress.isSuccess && view === "list" && (
        <div className="flex flex-col gap-6" data-skills-list>
          {SKILL_LEVELS.map((lv) => (
            <section key={lv.level} className="flex flex-col gap-2">
              <h2 className="text-base font-semibold text-ink dark:text-zinc-100">
                {lv.name[lang]} — {t("level", { level: lv.level })}
              </h2>
              <table className="w-full max-w-4xl text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-fade">
                    <th className="w-16 py-1">{t("listNumber")}</th>
                    <th className="py-1">{t("listSkill")}</th>
                    <th className="w-44 py-1">{t("listPath")}</th>
                    {!overview && <th className="w-32 py-1">{t("listState")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {SKILLS.filter((s) => s.level === lv.level && inPath(s.key)).map((s) => {
                    const st = stateOf(s.key)?.state ?? "closed";
                    return (
                      <tr key={s.key} className="border-t border-card-rim dark:border-zinc-800" data-skill-row={s.key} data-state={st}>
                        <td className="py-1.5 font-semibold">{s.number}</td>
                        <td className="py-1.5">
                          {st === "open" && !overview ? (
                            <Link href={skillHref(s.key)} className="text-cta hover:underline">
                              {s.name[lang]}
                            </Link>
                          ) : (
                            s.name[lang]
                          )}
                        </td>
                        <td className="py-1.5 text-fade">{pathShort(s.path)}</td>
                        {!overview && (
                          <td className="py-1.5">
                            <span className="inline-flex items-center gap-1.5">
                              {stateName(st)}
                              {(st === "mastered" || st === "obsolete") && <MasteryBadge small />}
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      {selectedSkill && selectedProgress && (
        <aside
          className="fixed bottom-6 right-6 z-30 flex w-80 flex-col gap-2 rounded-lg border border-card-rim bg-white p-4 text-sm shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
          aria-label={`${selectedSkill.number} ${selectedSkill.name[lang]}`}
          data-skill-panel={selectedSkill.key}
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-semibold text-ink dark:text-zinc-100">
              {selectedSkill.number} {selectedSkill.name[lang]}
            </h2>
            <IconButton icon={X} label={t("panel.close")} variant="bare" size="xs" onClick={() => setSelected(null)} />
          </div>
          <p className="text-xs text-fade">{t("panel.levelPath", { level: levelName(selectedSkill.level), path: pathName(selectedSkill.path) })}</p>
          {!overview && (
            <p>
              <span className="font-semibold">{stateName(selectedProgress.state)}</span> — {t(`stateHelp.${selectedProgress.state}`)}
            </p>
          )}
          <p className="text-fade">{selectedSkill.description[lang]}</p>
          {/* #39.50: „Prezentare” shows no state, so its panel is the skill and where the manual teaches it. */}
          {overview && <SectionList title={t("panel.sections")} sections={sections[selectedSkill.key] ?? []} />}
          {!overview && selectedProgress.state === "closed" && (
            <div className="flex flex-col gap-1" data-skill-missing>
              <p className="font-semibold">{t("panel.missing")}</p>
              <ul className="flex list-disc flex-col gap-0.5 pl-5">
                {selectedSkill.predecessors
                  .map((k) => byKey.get(k))
                  .filter((s): s is Skill => !!s)
                  .filter((s) => {
                    const st = stateOf(s.key)?.state;
                    return st !== "mastered" && st !== "obsolete";
                  })
                  .map((s) => (
                    <li key={s.key} data-missing={s.key}>
                      {s.number} {s.name[lang]} — {stateName(stateOf(s.key)?.state ?? "closed")}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {!overview && (selectedProgress.state === "mastered" || selectedProgress.state === "obsolete") && selectedProgress.masteredAt && (
            <p>{t("panel.masteredOn", { date: date(selectedProgress.masteredAt) })}</p>
          )}
          {!overview && selectedProgress.state === "obsolete" && <p className="text-fade">{t("panel.obsoleteNote")}</p>}
          {/* Slice #39.43: a mastered skill's manual sections. */}
          {!overview && (selectedProgress.state === "mastered" || selectedProgress.state === "obsolete") && (
            <SectionList title={t("panel.sections")} sections={sections[selectedSkill.key] ?? []} />
          )}
        </aside>
      )}
    </div>
  );
}
