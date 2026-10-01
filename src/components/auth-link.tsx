"use client";

import { LogIn, UserPlus } from "lucide-react";
import { LeadingIcon } from "@/lib/ui/icon-button";

/**
 * The link under the sign-in and request-access forms, with its icon before
 * the words — UserPlus for „Solicită acces", LogIn for „Conectare".
 *                                                         (Slice #37.47, A109)
 *
 * A client component of its own because the two pages are server components,
 * and a server component cannot hand a component (the icon) across — see
 * `BackLink` in `src/components/back-arrow.tsx`. The page passes which link it
 * is, as a string, and this file picks the icon. The link keeps the look it
 * had; the icon is decoration and the words stay its name.
 */
const ICONS = { "request-access": UserPlus, "sign-in": LogIn } as const;

export function AuthLink({ href, label, kind }: { href: string; label: string; kind: keyof typeof ICONS }) {
  return (
    <a href={href} className="text-cta hover:underline font-medium">
      <LeadingIcon icon={ICONS[kind]} />
      {label}
    </a>
  );
}
