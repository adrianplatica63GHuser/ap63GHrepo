import { getTranslations } from "next-intl/server";
import { AskBox } from "./_components/ask-box";

/**
 * /ask — „Întreabă”, in „Ajutor și învățare”.                                                    (Slice #39.45)
 *
 * A question in plain words, answered from the user manual: the sections at once, a short AI answer on request.
 * The same box stands at the top of „Manual de utilizare”. Manual 13.5.
 */
export default async function AskPage() {
  const t = await getTranslations("ask");
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full max-w-3xl flex-col gap-4 px-6 py-8" data-ask-screen>
        <h1 className="text-2xl font-semibold text-ink dark:text-zinc-100">{t("title")}</h1>
        <AskBox />
      </main>
    </div>
  );
}
