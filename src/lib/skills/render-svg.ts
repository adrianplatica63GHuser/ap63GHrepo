/**
 * Skills.Graph.svg — a PLAIN drawing of the skills graph, for Adrian to judge its shape.   (Slice #39.36)
 *
 * Ask first 3: four columns, one per level, the boxes in number order, straight arrows. Deliberately plain — the
 * real diagram, with each level's colour and the closed / open / mastered states, is 39.42's; this one only has to
 * show which box feeds which. An arrow that skips a level (Basic → Advanced, Intermediate → Expert) is drawn dashed,
 * and passes behind the column it skips.
 *
 * Generated from the catalogue, never typed: `scripts/skills/render-inventory.ts` writes it. PURE.
 */

import { escapeXml } from "@/lib/docx/xml";
import { SKILL_LEVELS, type Skill, type SkillLevel, type SkillPath } from "@/lib/skills/catalogue";

export type SvgInput = { skills: readonly Skill[]; paths: readonly SkillPath[] };

const BOX_W = 250;
const COL_GAP = 120;
const MARGIN = 40;
const HEADER_H = 70;
const LINE_H = 14;
const BOX_PAD = 10;
const BOX_GAP = 14;
const MAX_CHARS = 36;

export { escapeXml };

/** Greedy word wrap to at most `max` characters a line (a single longer word keeps its own line). */
export function wrapWords(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= max) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

type Placed = { skill: Skill; x: number; y: number; h: number; lines: string[] };

export function renderSkillsSvg({ skills, paths }: SvgInput): string {
  const pathName = new Map(paths.map((p) => [p.key, p.name.ro]));
  const byNumber = (a: Skill, b: Skill) => Number(a.number.split(".")[1]) - Number(b.number.split(".")[1]);

  const columns = SKILL_LEVELS.map((lv) => {
    const inLevel = skills.filter((s) => s.level === lv.level).sort(byNumber);
    const boxes = inLevel.map((skill) => {
      const lines = wrapWords(skill.name.ro, MAX_CHARS);
      return { skill, lines, h: BOX_PAD * 2 + 16 + lines.length * LINE_H + 14 };
    });
    const height = boxes.reduce((n, b) => n + b.h, 0) + Math.max(0, boxes.length - 1) * BOX_GAP;
    return { level: lv.level as SkillLevel, boxes, height };
  });
  const tallest = Math.max(...columns.map((c) => c.height));

  const placed = new Map<string, Placed>();
  columns.forEach((col, i) => {
    const x = MARGIN + i * (BOX_W + COL_GAP);
    let y = MARGIN + HEADER_H + (tallest - col.height) / 2;
    for (const b of col.boxes) {
      placed.set(b.skill.key, { skill: b.skill, x, y, h: b.h, lines: b.lines });
      y += b.h + BOX_GAP;
    }
  });

  const width = MARGIN * 2 + SKILL_LEVELS.length * BOX_W + (SKILL_LEVELS.length - 1) * COL_GAP;
  const height = MARGIN * 2 + HEADER_H + tallest + 40;

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Segoe UI, Arial, sans-serif">`,
    `<title>Harta abilităților — ${skills.length} abilități</title>`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#334155"/></marker></defs>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`,
  );

  SKILL_LEVELS.forEach((lv, i) => {
    const cx = MARGIN + i * (BOX_W + COL_GAP) + BOX_W / 2;
    out.push(
      `<text x="${cx}" y="${MARGIN + 22}" text-anchor="middle" font-size="20" font-weight="700" fill="#0f172a">${escapeXml(lv.name.ro.toUpperCase())}</text>`,
      `<text x="${cx}" y="${MARGIN + 44}" text-anchor="middle" font-size="13" fill="#475569">${escapeXml(`Nivelul ${lv.level} · ${lv.name.en}`)}</text>`,
    );
  });

  // Arrows first, so the boxes sit on top of them.
  for (const s of skills) {
    const to = placed.get(s.key);
    if (!to) continue;
    for (const p of s.predecessors) {
      const from = placed.get(p);
      if (!from) continue;
      const skips = to.skill.level - from.skill.level > 1;
      const x1 = from.x + BOX_W;
      const y1 = from.y + from.h / 2;
      const x2 = to.x - 2;
      const y2 = to.y + to.h / 2;
      out.push(
        `<line x1="${x1}" y1="${y1.toFixed(1)}" x2="${x2}" y2="${y2.toFixed(1)}" stroke="#334155" stroke-width="1.2"${skips ? ' stroke-dasharray="6 4" stroke-opacity="0.7"' : ""} marker-end="url(#arrow)"><title>${escapeXml(`${from.skill.number} → ${to.skill.number}`)}</title></line>`,
      );
    }
  }

  for (const b of placed.values()) {
    const { skill, x, y, h, lines } = b;
    out.push(
      `<g><title>${escapeXml(`${skill.number} ${skill.name.en} (${skill.key})`)}</title>`,
      `<rect x="${x}" y="${y.toFixed(1)}" width="${BOX_W}" height="${h}" rx="8" fill="#ffffff" stroke="#334155" stroke-width="1.3"/>`,
      `<text x="${x + BOX_PAD}" y="${(y + BOX_PAD + 13).toFixed(1)}" font-size="14" font-weight="700" fill="#0f172a">${escapeXml(skill.number)}</text>`,
    );
    lines.forEach((line, i) => {
      out.push(
        `<text x="${x + BOX_PAD}" y="${(y + BOX_PAD + 16 + (i + 1) * LINE_H).toFixed(1)}" font-size="12" fill="#0f172a">${escapeXml(line)}</text>`,
      );
    });
    out.push(
      `<text x="${x + BOX_W - BOX_PAD}" y="${(y + BOX_PAD + 13).toFixed(1)}" text-anchor="end" font-size="10" fill="#64748b">${escapeXml(pathName.get(skill.path) ?? skill.path)}</text>`,
      `</g>`,
    );
  }

  out.push(
    `<text x="${MARGIN}" y="${height - 18}" font-size="11" fill="#475569">${escapeXml(
      "Săgeata A → B: A trebuie stăpânită înainte de B. Linie punctată: săgeata sare un nivel (De bază → Avansat, Intermediar → Expert). Generat din src/lib/skills/catalogue.ts.",
    )}</text>`,
    `</svg>`,
  );
  return out.join("\n") + "\n";
}
