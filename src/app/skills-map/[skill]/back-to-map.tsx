"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LeadingIcon } from "@/lib/ui/icon-button";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";

/**
 * „Înapoi la hartă” — a client component of its own because LeadingIcon is one, and a server page cannot hand
 * a client component an icon: a component is a function, and functions do not cross that boundary. (#39.42)
 *
 * It goes through the unsaved-changes guard, so a quiz left half answered asks first (#39.43, TC-SKILL-02 step 3).
 */
export function BackToMap({ label }: { label: string }) {
  const { guardedNavigate } = useUnsavedChanges();
  return (
    <Link
      href="/skills-map"
      className="inline-flex items-center text-cta hover:underline"
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        guardedNavigate("/skills-map");
      }}
    >
      <LeadingIcon icon={ArrowLeft} />
      {label}
    </Link>
  );
}
