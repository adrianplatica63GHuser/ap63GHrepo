import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChangePasswordForm } from "./change-password-form";

// FU-072 (Slice #37.07): the browser tab in the user's language.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.changePassword");
  return { title: t("pageTitle") };
}

// FU-246 (Slice #37.07): the whole screen was English; every string is now
// from messages/*.json → auth.changePassword.
export default async function ChangePasswordPage() {
  const t = await getTranslations("auth.changePassword");
  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-1">{t("heading")}</h1>
      <p className="text-sm text-fade mb-6">{t("intro")}</p>
      <div className="bg-surface rounded-xl border border-wire shadow-sm p-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
