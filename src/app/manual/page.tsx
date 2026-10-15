import { Suspense } from "react";
import { AskBox } from "@/app/ask/_components/ask-box";
import { ManualView } from "./_components/manual-view";

/**
 * /manual — „Manual de utilizare”, in „Ajutor și învățare”.                                   (Slice #39.37)
 *
 * The contents on the left, the chapter on the right, the section in the address (`?s=<id>`) so anything can link
 * to it — a „?” popover (39.40), a quiz question (39.43), an answer (39.45). „Descarcă (Word)” hands out the same
 * manual as a .docx, in the application's language. The source is src/lib/manual/content; the format is
 * src/lib/manual/format.ts.
 *
 * #39.45: „Întreabă”'s box stands at the top (Ask first 3) — a question in plain words finds its sections here too.
 */
export default function ManualPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <AskBox compact />
        <Suspense>
          <ManualView />
        </Suspense>
      </main>
    </div>
  );
}
