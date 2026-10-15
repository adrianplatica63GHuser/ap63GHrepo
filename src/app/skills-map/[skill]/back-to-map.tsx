"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LeadingIcon } from "@/lib/ui/icon-button";

/**
 * „Înapoi la hartă” — a client component of its own because LeadingIcon is one, and a server page cannot hand
 * a client component an icon: a component is a function, and functions do not cross that boundary. (#39.42)
 */
export function BackToMap({ label }: { label: string }) {
  return (
    <Link href="/skills-map" className="inline-flex items-center text-cta hover:underline">
      <LeadingIcon icon={ArrowLeft} />
      {label}
    </Link>
  );
}
