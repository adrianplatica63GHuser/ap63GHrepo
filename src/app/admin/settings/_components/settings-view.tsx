"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocaleCookie } from "@/lib/i18n/locale";

const DEV_ENGLISH_KEY = "dev-use-english";

export function SettingsView() {
  const t = useTranslations("settings");
  const router = useRouter();

  // Checkbox state is driven by localStorage, NOT useLocale().
  // Initialised lazily so the correct value is read once on mount without
  // needing a synchronous setState-in-effect (which the linter disallows).
  const [isEnglish, setIsEnglish] = useState(() => {
    if (typeof window === "undefined") return false;
    const devEnglish = localStorage.getItem(DEV_ENGLISH_KEY) === "true";
    // Ensure the locale cookie matches the stored preference.
    // Clears any leftover en-GB cookie from before Slice #20.10.
    setLocaleCookie(devEnglish ? "en-GB" : "ro-RO");
    return devEnglish;
  });
  const [showDevNotes, setShowDevNotes] = useState(false);

  function handleLanguageToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked;
    setIsEnglish(checked);
    if (checked) {
      localStorage.setItem(DEV_ENGLISH_KEY, "true");
      setLocaleCookie("en-GB");
    } else {
      localStorage.removeItem(DEV_ENGLISH_KEY);
      setLocaleCookie("ro-RO");
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-wire bg-card p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-ink">{t("sectionDeveloper")}</h2>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isEnglish}
            onChange={handleLanguageToggle}
            className="h-4 w-4 rounded border-wire accent-blue-600"
          />
          <span className="text-sm text-ink">{t("useEnglish")}</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDevNotes}
            onChange={(e) => setShowDevNotes(e.target.checked)}
            className="h-4 w-4 rounded border-wire accent-blue-600"
          />
          <span className="text-sm text-ink">{t("showDevNotes")}</span>
        </label>

        {showDevNotes && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100 flex flex-col gap-3">
            <p className="font-semibold">Multi-user model is not production-ready</p>
            <p>
              There are only two roles (superuser, user) with no granular permissions.
              The Ciprian scenario is handled via a separate UAT environment rather than
              a proper multi-user production model. If more users are coming (which the
              user request flow implies), you need to define: can a &quot;user&quot; create
              persons? edit properties? delete documents? approve other users? The current
              system gives &quot;user&quot; role access to everything except presumably the
              admin screens — but this is undocumented and likely not enforced at the route
              level with any granularity.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
