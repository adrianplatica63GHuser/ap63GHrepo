import { getTranslations } from "next-intl/server";

/**
 * Welcome / landing screen.  Navigation lives in the sidebar — this page is
 * shown when the user hasn't navigated anywhere specific yet.
 */
export default async function Home() {
  const t = await getTranslations("welcome");

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-canvas px-6 py-16 gap-3">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        {t("title")}
      </h1>
      <p className="text-sm text-fade text-center max-w-sm">
        {t("subtitle")}
      </p>
    </div>
  );
}
