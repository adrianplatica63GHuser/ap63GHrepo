import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { screenPanel } from "@/lib/ui/field-widths";
import { UnitRow } from "@/components/screen/unit-row";
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
    // Slice #37.22: left-aligned beside the sidebar, the card a panel wide —
    // no longer a `max-w-sm` column centred in the window.
    <div className="p-6">
      <h1 className="text-2xl font-bold text-ink mb-1">{t("heading")}</h1>
      <p className="text-sm text-fade mb-6">{t("intro")}</p>
      {/* Slice #37.35: the card is a 3-unit tile on the screen's unit row. */}
      <UnitRow units={[3]}>
        <div {...screenPanel("change-password", 3)} className="bg-surface rounded-xl border border-wire shadow-sm p-6">
          <ChangePasswordForm />
        </div>
      </UnitRow>
    </div>
  );
}
