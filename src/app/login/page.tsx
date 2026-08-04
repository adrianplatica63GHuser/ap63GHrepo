import { getTranslations } from "next-intl/server";
import { LocaleToggle } from "@/components/locale-toggle";
import { DevOnly } from "@/components/dev-only";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — GA40" };

export default async function LoginPage() {
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
          <a href="/signup" className="text-cta hover:underline font-medium">
            {t("login.requestAccess")}
          </a>
        </p>
      </div>
    </div>
  );
}
