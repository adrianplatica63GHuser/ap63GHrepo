import { SkillsMapView } from "./_components/skills-map-view";

/**
 * /skills-map — „Harta competențelor”, in „Ajutor și învățare”.                               (Slice #39.42)
 *
 * The skills of src/lib/skills/catalogue.ts in four level columns, with the signed-in user's state on every
 * box; an Open box opens its quiz (/skills-map/<key>, #39.43). The drawing is skills-map-view.tsx; where the
 * boxes go is src/lib/skills/layout.ts, how they look src/lib/skills/appearance.ts, and the states
 * src/lib/skills/progress.ts.
 */
export default function SkillsMapPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <SkillsMapView />
      </main>
    </div>
  );
}
