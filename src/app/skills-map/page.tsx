import { getLocale } from "next-intl/server";
import { SKILLS } from "@/lib/skills/catalogue";
import { sectionLinks } from "@/lib/skills/quiz-server";
import { SkillsMapView } from "./_components/skills-map-view";

/**
 * /skills-map — „Harta competențelor”, in „Ajutor și învățare”.                               (Slice #39.42)
 *
 * The skills of src/lib/skills/catalogue.ts in four level columns, with the signed-in user's state on every
 * box; an Open box opens its quiz (/skills-map/<key>, #39.43). The drawing is skills-map-view.tsx; where the
 * boxes go is src/lib/skills/layout.ts, how they look src/lib/skills/appearance.ts, and the states
 * src/lib/skills/progress.ts.
 *
 * Slice #39.43: each skill's manual sections, resolved here to number and title — so a Mastered box's panel can
 * name them without the manual's text entering the screen's bundle.
 */
export default async function SkillsMapPage() {
  const locale = (await getLocale()) === "en-GB" ? "en-GB" : "ro-RO";
  const sections = Object.fromEntries(SKILLS.map((s) => [s.key, sectionLinks(s.manual, locale)]));
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <SkillsMapView sections={sections} />
      </main>
    </div>
  );
}
