"use client";

import { usePathname } from "next/navigation";
import { HelpButton } from "./help-button";
import { resolveRegisteredHelpScreenKey } from "@/lib/help/route-map";

type Props = {
  className?: string;
  /**
   * Forwarded to <HelpButton>. This wrapper exists because neither mount
   * renders HelpButton directly, and `className` cannot carry it: className
   * lands on the wrapper <div>, not on the popover panel (Slice #32.20).
   */
  align?: "left" | "right";
};

/**
 * Route-aware wrapper around <HelpButton>  (Slice #21.10.help.rollout).
 *
 * Works out which help screen the current route belongs to and renders the
 * "?" button for it. Takes no screenKey prop — that is the entire point:
 * before this slice every page had to pass its own key, and only one page
 * ever did, leaving 10 registered screens permanently unreachable.
 *
 * Mounted once in <BreadcrumbBar>, which covers every screen in the app.
 * The dashboard mounts it separately because the breadcrumb hides itself on
 * the home page — see the comment there.
 *
 * Renders nothing when the route has no registered screen, and <HelpButton>
 * itself renders nothing when that screen has no content yet, so an
 * unconfigured screen shows no empty affordance.
 */
export function ScreenHelpButton({ className, align }: Props) {
  const pathname = usePathname();
  const screenKey = resolveRegisteredHelpScreenKey(pathname ?? "/");

  if (!screenKey) return null;

  return <HelpButton screenKey={screenKey} className={className} align={align} />;
}
