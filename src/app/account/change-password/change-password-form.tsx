"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { screenBox } from "@/lib/ui/field-widths";
import { buttonClass } from "@/lib/ui/button-styles";

type State = "idle" | "saving" | "success" | "error";

export function ChangePasswordForm() {
  const router         = useRouter();
  // FU-246 (Slice #37.07): every string from auth.changePassword.
  const t              = useTranslations("auth.changePassword");
  const [newPwd, setNewPwd]         = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [state, setState]           = useState<State>("idle");
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (newPwd.length < 8) {
      setErrorMsg(t("errorTooShort"));
      return;
    }
    if (newPwd !== confirmPwd) {
      setErrorMsg(t("errorMismatch"));
      return;
    }

    setState("saving");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) {
        // The auth service's own sentence is English; the user gets a Romanian
        // one, and the service's goes to the console for whoever debugs it.
        console.warn("[change-password] updateUser refused:", error.message);
        setErrorMsg(t("errorRejected"));
        setState("error");
        return;
      }
      setState("success");
      setTimeout(() => router.push("/"), 2000);
    } catch {
      setErrorMsg(t("errorGeneric"));
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="text-center py-4">
        <div className="text-3xl mb-2">✓</div>
        <p className="font-semibold text-ink">{t("successTitle")}</p>
        <p className="text-sm text-fade mt-1">{t("successRedirect")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="new-pwd" className="text-sm font-medium text-ink">
          {t("labelNew")}
        </label>
        <input
          {...screenBox("password")}
          id="new-pwd"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
          className="rounded-md border border-wire bg-base px-3 py-2 text-sm text-ink outline-none focus:border-cta focus:ring-1 focus:ring-cta transition"
          disabled={state === "saving"}
        />
        <p className="text-xs text-fade">{t("hintMin")}</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirm-pwd" className="text-sm font-medium text-ink">
          {t("labelConfirm")}
        </label>
        <input
          {...screenBox("password")}
          id="confirm-pwd"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPwd}
          onChange={(e) => setConfirmPwd(e.target.value)}
          className="rounded-md border border-wire bg-base px-3 py-2 text-sm text-ink outline-none focus:border-cta focus:ring-1 focus:ring-cta transition"
          disabled={state === "saving"}
        />
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {errorMsg}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={state === "saving"}
          className={buttonClass({ variant: "primary", size: "lg", className: "flex-1" })}
        >
          {state === "saving" ? t("buttonSaving") : t("buttonSave")}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className={buttonClass({ variant: "secondary", size: "lg" })}
        >
          {t("buttonCancel")}
        </button>
      </div>
    </form>
  );
}
