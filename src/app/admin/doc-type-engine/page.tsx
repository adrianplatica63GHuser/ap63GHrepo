import { getTranslations } from "next-intl/server";

import { DocTypeEngine } from "./_components/doc-type-engine";

/**
 * /admin/doc-type-engine — „Distilare Tipizate".                (Slice #29.09)
 *
 * kebab-case like every other admin route (`global-search`, `help-content`,
 * `value-lists`, `complex-query`).
 *
 * No guard of its own: every page under /admin/* is superuser-only, checked
 * server-side once in `src/app/admin/layout.tsx`. The sidebar hides the whole
 * Administration section for everyone else, but that is UI — the layout is what
 * blocks a typed-in URL.
 *
 * ⚠️ **NO `dynamic(..., { ssr: false })` WRAPPER, AND THE FIRST DRAFT HAD ONE.**
 * It was copied from `import-browser-dynamic.tsx`, whose justification is
 * specific and real: the import wizard branches on `"showDirectoryPicker" in
 * window` DURING RENDER, so its server tree and its first client tree differ and
 * every supported browser hydrates with an error. This screen's support check is
 * inside the picker's click handler and nothing in its JSX reads `window`, so
 * there is no mismatch to avoid — the wrapper was a file and a comment
 * preserving a reason that was not true here. An adversarial round said so.
 *
 * ⚠️ The code name „DocTypeEngine" is the ENGLISH name and appears here, in
 * en-GB.json and in comments. The Romanian label is „Distilare Tipizate" and
 * ro-RO.json carries no code name — a rule #29.08 broke in passing (its
 * `typesBlocked.whatNext` string named DocTypeEngine in Romanian) and this
 * slice repairs, because it is the slice that gives the screen a Romanian name
 * to point at.
 */
export default async function DocTypeEnginePage() {
  const t = await getTranslations("docTypeEngine");

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col gap-4 px-6 py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        </header>

        <DocTypeEngine />
      </main>
    </div>
  );
}
