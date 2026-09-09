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
/**
 * ⚠️ **`searchParams` since Slice #34.10, and it is read on the SERVER rather
 * than with `useSearchParams` in the client component.** `useSearchParams`
 * under a statically-rendered page needs a Suspense boundary to build at all;
 * awaiting `searchParams` here opts this page into dynamic rendering, which is
 * what a page that reads a query parameter should be anyway. It is the shape
 * `admin/groups/[id]/page.tsx` already uses for `?from=`.
 */
export default async function DocTypeEnginePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const t = await getTranslations("docTypeEngine");
  /**
   * The type the import's stop screen was talking about.
   *
   * ⚠️ **Passed as an INITIAL value, never as a controlled one.** It seeds the
   * picker on mount and the user is free to change it immediately — a param
   * that kept re-selecting would fight the control it landed on. And it is not
   * validated here: the catalogue this screen fetches is the only thing that
   * knows which ids exist, so an id that is not in it simply selects nothing,
   * which is the same state the screen opens in without the param.
   */
  const { type } = await searchParams;

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col gap-4 px-6 py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        </header>

        <DocTypeEngine initialTypeId={type ?? ""} />
      </main>
    </div>
  );
}
