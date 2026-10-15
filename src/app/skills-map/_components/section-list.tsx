"use client";

import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { LeadingIcon } from "@/lib/ui/icon-button";

export type SectionLinkData = { id: string; href: string; number: string; title: string };

/** Manual sections as links: „§2.2 Bara laterală”. A client component, for LeadingIcon (#39.43). */
export function SectionList({ title, sections }: { title: string; sections: readonly SectionLinkData[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="flex flex-col gap-1" data-quiz-sections>
      <p className="text-sm font-semibold text-ink dark:text-zinc-100">{title}</p>
      <ul className="flex flex-col gap-1">
        {sections.map((s) => (
          <li key={s.id}>
            <Link href={s.href} className="inline-flex items-baseline text-sm text-cta hover:underline" data-quiz-section={s.id}>
              <LeadingIcon icon={BookOpenText} />
              {`§${s.number} ${s.title}`}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
