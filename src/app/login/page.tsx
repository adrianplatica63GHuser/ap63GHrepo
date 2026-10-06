import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthLink } from "@/components/auth-link";
import { LocaleToggle } from "@/components/locale-toggle";
import { LoginForm } from "./login-form";

// FU-072 (Slice #37.07): the browser tab says the page's name in the user's
// language, from messages/*.json, like every other string on the screen.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("pageTitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-base p-4">
      {/* Locale toggle — top-right corner. Slice #38.22: shown everywhere (it was
          developer-only from #23.10.dev): Adrian and Ciprian both check the English
          wording, and it must work before anyone is signed in. */}
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
          <h2 className="text-lg font-semibold text-ink mb-5">{t("login.heading")}</h2>
          <LoginForm
            labelIdentity={t("login.labelIdentity")}
            placeholderIdentity={t("login.placeholderIdentity")}
            labelPassword={t("login.labelPassword")}
            buttonSignIn={t("login.buttonSignIn")}
            buttonSigningIn={t("login.buttonSigningIn")}
            errorInvalidCredentials={t("login.errorInvalidCredentials")}
            errorGeneric={t("login.errorGeneric")}
          />
        </div>

        <p className="text-center text-sm text-fade mt-5">
          {t("login.noAccount")}{" "}
          <AuthLink href="/signup" label={t("login.requestAccess")} kind="request-access" />
        </p>
      </div>
    </div>
  );
}
