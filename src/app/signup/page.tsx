import { getTranslations } from "next-intl/server";
import { LocaleToggle } from "@/components/locale-toggle";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Request Access — GA40" };

export default async function SignupPage() {
  const t = await getTranslations("auth");

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-base p-4">
      {/* Locale toggle — top-right corner */}
      <div className="absolute top-4 right-4">
        <LocaleToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-ink tracking-tight">GA40</h1>
          <p className="text-sm text-fade mt-1">{t("appSubtitle")}</p>
        </div>

        <div className="bg-surface rounded-xl border border-wire shadow-sm p-6">
          <h2 className="text-lg font-semibold text-ink mb-1">{t("signup.heading")}</h2>
          <p className="text-sm text-fade mb-5">
            {t("signup.subheading")}
          </p>
          <SignupForm
            labelEmail={t("signup.labelEmail")}
            labelUsername={t("signup.labelUsername")}
            hintUsername={t("signup.hintUsername")}
            buttonSubmit={t("signup.buttonSubmit")}
            buttonSubmitting={t("signup.buttonSubmitting")}
            errorGeneric={t("signup.errorGeneric")}
            errorUnexpected={t("signup.errorUnexpected")}
            successTitle={t("signup.successTitle")}
            successMessage={t("signup.successMessage")}
          />
        </div>

        <p className="text-center text-sm text-fade mt-5">
          {t("signup.alreadyHaveAccount")}{" "}
          <a href="/login" className="text-cta hover:underline font-medium">
            {t("signup.signIn")}
          </a>
        </p>
      </div>
    </div>
  );
}
