import { getTranslations } from "next-intl/server";
import { Construction } from "lucide-react";
import { PROSE_STYLE } from "@/lib/ui/field-widths";

/**
 * „Rapoarte — în lucru".                                        (Slice #38.20)
 *
 * The sidebar's „Rapoarte" section opens this page until reports are built:
 * what they will offer, in a business user's words (Adrian asked Claude to
 * word it; the Romanian is the text, the English a translation of it).
 */
export default async function ReportsPage() {
  const t = await getTranslations("reports");
  const paragraphs = ["intro", "questions", "analysis", "results", "noSkills"] as const;
  return (
    <main className="px-4 py-8" data-reports-page>
      <h1 className="mb-6 flex items-center gap-2.5 text-2xl font-bold text-ink dark:text-zinc-100">
        <Construction size={24} aria-hidden="true" className="shrink-0 text-fade" />
        {t("title")}
      </h1>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-ink dark:text-zinc-200" style={PROSE_STYLE}>
        {paragraphs.map((k) => (
          <p key={k}>{t(k)}</p>
        ))}
      </div>
    </main>
  );
}
