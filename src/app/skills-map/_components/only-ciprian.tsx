"use client";

/**
 * „Numai Ciprian!” — a button on the skills map that says who takes the quizzes on Ciprian's box.   (Slice #39.56)
 *
 * Adrian, 2026-10-15: „Add a new button on the skills map that has the caption “Only Ciprian!” … When it's clicked,
 * it should provide a small explanation that only Ciprian can take the quiz — no other user”. Why it is true
 * (#39.51): a box without accounts (UAT_NO_AUTH=true) stores every attempt under one id, „uat-no-auth”, so a quiz
 * anyone takes there counts as Ciprian's. The command that would move his progress to an account one day
 * (skills:adopt-progress) is Adrian's, so the text says it can be done and does not tell Ciprian to run anything.
 *
 * Shown on every installation, so Adrian sees what Ciprian sees (Ask first 2); on a box with accounts it adds the
 * sentence that each account has its own progress. A small popover anchored to the button, not a dialog (Ask
 * first 3): Escape, a click outside or „Închide” closes it, and Escape and „Închide” put the focus back on the
 * button.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UserLock, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";

export function OnlyCiprian({ hasAccounts }: { hasAccounts: boolean }) {
  const t = useTranslations("skillsMap.onlyCiprian");
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  const wrap = useRef<HTMLSpanElement | null>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <span ref={wrap} className="relative inline-flex" data-only-ciprian="">
      <IconButton
        ref={button}
        icon={UserLock}
        label={t("button")}
        showLabel
        variant="secondary"
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={titleId}
          data-only-ciprian-panel=""
          className="absolute right-0 top-full z-50 mt-2 flex w-80 flex-col gap-2 rounded-lg border border-card-rim bg-white p-4 text-sm text-ink shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 id={titleId} className="font-semibold">
              {t("title")}
            </h2>
            <IconButton icon={X} label={t("close")} variant="bare" size="xs" onClick={close} />
          </div>
          <p className="font-semibold">{t("lead")}</p>
          <p>{t("noAccounts")}</p>
          <p>{t("moveLater")}</p>
          {hasAccounts && <p data-only-ciprian-accounts="">{t("withAccounts")}</p>}
        </div>
      )}
    </span>
  );
}
