import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthLink } from "@/components/auth-link";
import { LocaleToggle } from "@/components/locale-toggle";
import { DevOnly } from "@/components/dev-only";
import { SignupForm } from "./signup-form";

// FU-072 (Slice #37.07): the browser tab says the page's name in the user's
// language, from messages/*.json, like every other string on the screen.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("pageTitle") };
}

export default async function SignupPage() {
  const t = await getTranslations("auth");

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-base p-4">
      {/* Locale toggle — top-right corner.
          Slice #23.10.dev: developer-only. Every user of this application is
          Romanian, so an English flag on the sign-in page is a control that can
          only do harm there. It stays on a developer build because checking the
          English rendering of the auth screens needs a switch that works before
          anyone is signed in. */}
      <DevOnly>
        <div className="absolute top-4 right-4">
          <LocaleToggle />
        </div>
      </DevOnly>

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
          <AuthLink href="/login" label={t("signup.signIn")} kind="sign-in" />
        </p>
      </div>
    </div>
  );
}
