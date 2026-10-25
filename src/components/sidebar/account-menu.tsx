"use client";

/**
 * The account entry at the bottom of the sidebar, and its menu.                              (Slice 40.59, Figura 8.3)
 *
 * Adrian, 2026-10-24 (GA40-Design-Improvements.docx, chapter 8b): „let's use figure 8.3" — and of „Night mode: keep the
 * checkbox (40.19), a moon button, or the account menu?" he chose the account menu. So the sidebar's header holds only
 * GA40 and the collapse button, and everything about the person signed in lives here:
 *
 *   - the entry: a User icon, the username and a chevron, the full width of the bottom strip (Ask first 2); on the
 *     collapsed rail, the User icon alone, the username its name and tooltip. In UAT it reads „UAT" (Ask first 3).
 *   - the menu, opening upward over the sidebar: „Autentificat ca <name>" first, muted (Ask first 4); „Limba" with
 *     40.58's RO | EN; „Aspect" with Zi | Noapte, the same control (Ask first 1); then „Ieșire" — or, in UAT, the
 *     uatNoAccounts note in its place. Ieșire stands above the strip, clear of Next's dev indicator at the bottom left
 *     that once took its clicks (#38.41).
 *
 * Enter or Space on the entry opens it (it is a button) and puts the focus on its first control; Esc and a press outside
 * close it, Esc giving the focus back to the entry; the arrow keys, Home and End move through its controls. It is drawn
 * `fixed`, above the entry, so the rail's 56 px — and the sidebar's `overflow-hidden` — cannot clip it. Closed, it stays
 * in the page, hidden, as the „Panouri" panel does (40.57).
 */
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, LogOut, User } from "lucide-react";

import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeSwitch } from "@/components/theme-toggle";
import { IconButton, LeadingIcon, TrailingIcon } from "@/lib/ui/icon-button";

/** Where the menu stands: its left edge on the entry's, its bottom 4 px above the entry's top. */
type Place = { left: number; bottom: number };

const MENU_GAP_PX = 4;

export function AccountMenu({
  username,
  uat,
  collapsed,
  onSignOut,
}: {
  username?: string;
  uat: boolean;
  collapsed: boolean;
  onSignOut: () => void;
}) {
  const t = useTranslations("nav");
  const tTheme = useTranslations("theme");
  const tAccount = useTranslations("settings.account");
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const menuId = useId();
  const entryId = `${menuId}-entry`;
  const name = uat ? "UAT" : (username ?? "");

  const measure = (): Place | null => {
    const r = document.getElementById(entryId)?.getBoundingClientRect();
    return r ? { left: r.left, bottom: window.innerHeight - r.top + MENU_GAP_PX } : null;
  };
  const toggle = () => {
    if (!open) setPlace(measure());
    setOpen(!open);
  };

  useEffect(() => {
    if (!open) return;
    const menu = () => document.getElementById(menuId);
    const inside = (target: EventTarget | null): boolean =>
      target instanceof Node && (!!document.getElementById(entryId)?.contains(target) || !!menu()?.contains(target));
    // The first control takes the focus, so the keyboard is in the menu at once.
    const frame = requestAnimationFrame(() => menu()?.querySelector<HTMLElement>("button")?.focus());
    const onDown = (e: PointerEvent) => {
      if (!inside(e.target)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      document.getElementById(entryId)?.focus();
    };
    const onResize = () => setPlace(measure());
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // The arrow keys, Home and End move through the menu's controls, round at the ends.
  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button")];
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : e.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
    items[next].focus();
  };

  const entryProps = {
    id: entryId,
    "aria-haspopup": "true" as const,
    "aria-expanded": open,
    "aria-controls": menuId,
    onClick: toggle,
    "data-account-entry": "",
  };

  return (
    <>
      {collapsed ? (
        <IconButton icon={User} label={name || t("account")} variant="bare" size="sm" {...entryProps} />
      ) : (
        <button
          type="button"
          {...entryProps}
          className="flex w-full min-w-0 items-center rounded-md px-2 py-1.5 text-sm text-ink transition-colors hover:bg-cta-pale focus-visible:outline-2 focus-visible:outline-focus dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <LeadingIcon icon={User} />
          <span className="min-w-0 flex-1 truncate text-left">{name}</span>
          <TrailingIcon icon={open ? ChevronDown : ChevronUp} />
        </button>
      )}
      <div
        id={menuId}
        hidden={!open}
        role="dialog"
        aria-label={t("account")}
        onKeyDown={onMenuKey}
        className="fixed z-50 w-60 rounded-md border border-card-rim bg-white p-3 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        style={place ? { left: place.left, bottom: place.bottom } : undefined}
        data-account-menu=""
      >
        {!uat && username && (
          <p className="mb-2 truncate text-xs text-fade dark:text-zinc-400" data-account-signed-in="">
            {t("signedInAs")} <span className="font-medium text-ink dark:text-zinc-200">{username}</span>
          </p>
        )}
        <div className="flex items-center justify-between gap-3 py-1" data-account-row="language">
          <span className="text-ink dark:text-zinc-200">{tAccount("language")}</span>
          <LocaleToggle />
        </div>
        <div className="flex items-center justify-between gap-3 py-1" data-account-row="appearance">
          <span className="text-ink dark:text-zinc-200">{tTheme("appearance")}</span>
          <ThemeSwitch />
        </div>
        <div className="my-2 border-t border-wire dark:border-zinc-700" />
        {uat ? (
          // UAT (Slice #38.22): no Supabase session to sign out of — said, not hidden.
          <p className="text-xs text-fade dark:text-zinc-400" role="note" data-uat-no-accounts="sidebar">
            {t("uatNoAccounts")}
          </p>
        ) : (
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center rounded-md px-1 py-1 text-ink transition-colors hover:bg-cta-pale focus-visible:outline-2 focus-visible:outline-focus dark:text-zinc-200 dark:hover:bg-zinc-800"
            data-account-sign-out=""
          >
            <LeadingIcon icon={LogOut} />
            {t("signOut")}
          </button>
        )}
      </div>
    </>
  );
}
