"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink, Navigation, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { QrCodeSvg } from "@/components/maps/qr-code-svg";
import { destinationOf, navigationLink, type NavStart, type NavTarget } from "@/lib/geo/navigate";

/**
 * „Navighează" — a button, and the dialog it opens.                                  (Slice #39.35)
 *
 * The dialog (Ask first 3): where the route starts — „Locația mea" (the default: no origin, so the device's own
 * location) or an address typed as the origin — then „Deschide în Google Maps" (a new tab), the same link as a QR
 * code for the phone (with `dir_action=navigate`, so the Google Maps app starts navigating), „Copiază linkul", and a
 * line saying the route is Google's, by car. No Google request of any kind is made here: the link is built
 * (`navigationLink`) and drawn (`QrCodeSvg`) in the browser.
 *
 * The button is disabled, saying why, when the property has no shape and no address.
 */
/** The button's icon — also drawn by „Instrumente → Navigare"'s box (#39.78), so the two never differ. */
export const NAVIGATE_ICON = Navigation;

export function NavigateButton({
  target,
  name,
  size = "sm",
  showLabel = false,
}: {
  target: NavTarget;
  name: string;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
}) {
  const t = useTranslations("navigate");
  const [open, setOpen] = useState(false);
  const can = destinationOf(target, { kind: "device" }) !== null;
  return (
    <>
      <IconButton
        icon={NAVIGATE_ICON}
        label={t("button")}
        variant="secondary"
        size={size}
        showLabel={showLabel}
        disabled={!can}
        note={can ? undefined : t("noTarget")}
        onClick={() => setOpen(true)}
        data-navigate-button=""
      />
      {/* Slice 40.35: in <body>, since the button may stand on a map's top row, inside the map's own stacking context. */}
      {open && createPortal(<NavigateDialog target={target} name={name} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

export function NavigateDialog({ target, name, onClose }: { target: NavTarget; name: string; onClose: () => void }) {
  const t = useTranslations("navigate");
  const titleId = useId();
  const startId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [startKind, setStartKind] = useState<"device" | "address">("device");
  const [startText, setStartText] = useState("");
  const [copied, setCopied] = useState(false);

  const start: NavStart = startKind === "address" ? { kind: "address", text: startText } : { kind: "device" };
  const dest = destinationOf(target, start);
  const link = navigationLink(target, start);
  const phoneLink = navigationLink(target, start, true);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} data-navigate-dialog="" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-card p-5 shadow-xl dark:bg-zinc-900">
        <div className="flex items-start gap-2">
          <h2 id={titleId} className="min-w-0 flex-1 text-base font-semibold text-ink dark:text-zinc-100">
            {name ? t("title", { name }) : t("titleUnnamed")}
          </h2>
          <IconButton ref={closeRef} icon={X} label={t("close")} variant="bare" size="sm" onClick={onClose} />
        </div>

        <p className="text-sm text-ink dark:text-zinc-200" data-navigate-destination={dest?.kind === "address" ? "address" : dest ? dest.from : "none"}>
          {dest === null ? t("noTarget") : dest.kind === "address" ? t("toAddress", { address: dest.text }) : t("toShape")}
        </p>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 text-sm font-medium text-ink dark:text-zinc-100">{t("start")}</legend>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="radio" name={startId} checked={startKind === "device"} onChange={() => setStartKind("device")} className="mt-0.5 accent-[#3b5bdb]" />
            <span className="flex flex-col">
              <span>{t("startDevice")}</span>
              <span className="text-xs text-fade dark:text-zinc-400">{t("startDeviceHint")}</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name={startId} checked={startKind === "address"} onChange={() => setStartKind("address")} className="accent-[#3b5bdb]" />
            {t("startAddress")}
          </label>
          {startKind === "address" && (
            <input
              type="text"
              aria-label={t("startAddressLabel")}
              placeholder={t("startAddressPlaceholder")}
              value={startText}
              onChange={(e) => setStartText(e.target.value)}
              className="ml-6 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-ink placeholder:text-fade dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
          )}
        </fieldset>

        {phoneLink ? (
          <div className="flex items-center gap-4">
            <QrCodeSvg text={phoneLink} label={t("qr")} />
            <p className="text-xs text-fade dark:text-zinc-400">{t("qrHint")}</p>
          </div>
        ) : (
          <p className="text-xs text-fade dark:text-zinc-400" data-navigate-waiting="">
            {t("startAddressMissing")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {link ? (
            <IconButton
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              icon={ExternalLink}
              label={t("open")}
              showLabel
              variant="accent"
              size="md"
              data-navigate-link=""
            />
          ) : (
            <IconButton icon={ExternalLink} label={t("open")} showLabel variant="accent" size="md" disabled />
          )}
          <IconButton icon={Copy} label={copied ? t("copied") : t("copy")} showLabel variant="secondary" size="md" disabled={!link} onClick={() => void copy()} />
        </div>

        <p className="text-xs text-fade dark:text-zinc-400">{t("byGoogle")}</p>
      </div>
    </div>,
    document.body,
  );
}
