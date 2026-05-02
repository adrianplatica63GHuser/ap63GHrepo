import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleToggle } from "@/components/locale-toggle";

// ── Shared button styles ──────────────────────────────────────────────────────

const activeLinkClass = [
  "flex items-center justify-center rounded-lg px-3 py-3 min-h-[52px]",
  "bg-cta text-white text-sm font-medium text-center",
  "transition-colors hover:bg-cta-d",
].join(" ");

const disabledBtnClass = [
  "flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-3 min-h-[52px]",
  "bg-canvas text-fade text-sm font-medium text-center cursor-not-allowed",
  "dark:bg-zinc-800 dark:text-zinc-600",
].join(" ");

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-5 ${accent}`}>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Soon({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-normal leading-none text-fade dark:text-zinc-600">
      {label}
    </span>
  );
}

function DisabledBtn({ label, soon }: { label: string; soon: string }) {
  return (
    <button disabled className={disabledBtnClass}>
      <span>{label}</span>
      <Soon label={soon} />
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  const t = await getTranslations("home");
  const soon = t("soon");

  return (
    <div className="flex flex-1 flex-col bg-canvas dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-8 flex flex-col gap-6">

        {/* Header */}
        <header className="flex items-center justify-between">
          <LocaleToggle />
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-zinc-100">
              {t("title")}
            </h1>
            <p className="text-sm text-fade dark:text-zinc-400">
              {t("subtitle")}
            </p>
          </div>
          {/* Invisible spacer keeps the title centred */}
          <div className="invisible" aria-hidden>
            <LocaleToggle />
          </div>
        </header>

        {/* Sections */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          {/* ── People — light blue panel, strong blue border ── */}
          <Section
            title={t("sections.people")}
            accent="border-bl-strong bg-bl-light dark:border-blue-900 dark:bg-blue-950"
          >
            <div className="grid grid-cols-2 gap-3">
              <Link href="/natural-persons" className={activeLinkClass}>
                {t("buttons.naturalPerson")}
              </Link>
              <DisabledBtn label={t("buttons.judicialPerson")} soon={soon} />
            </div>
          </Section>

          {/* ── Property — light orange panel, strong orange border ── */}
          <Section
            title={t("sections.property")}
            accent="border-or-strong bg-or-light dark:border-green-900 dark:bg-green-950"
          >
            <div className="grid grid-cols-2 gap-3">
              <Link href="/properties" className={activeLinkClass}>
                {t("buttons.landList")}
              </Link>
              <Link href="/properties/map" className={activeLinkClass}>
                {t("buttons.landMap")}
              </Link>
              <DisabledBtn label={t("buttons.building")} soon={soon} />
              <DisabledBtn label={t("buttons.propertyType3")} soon={soon} />
            </div>
          </Section>

          {/* ── Paperwork — light grey panel, strong grey border ── */}
          <Section
            title={t("sections.paperwork")}
            accent="border-gy-strong bg-gy-light dark:border-amber-900 dark:bg-amber-950"
          >
            <div className="grid grid-cols-3 gap-3">
              <DisabledBtn label={t("buttons.paperwork1")} soon={soon} />
              <DisabledBtn label={t("buttons.paperwork2")} soon={soon} />
              <DisabledBtn label={t("buttons.paperwork3")} soon={soon} />
              <DisabledBtn label={t("buttons.paperwork4")} soon={soon} />
              <DisabledBtn label={t("buttons.paperwork5")} soon={soon} />
              <DisabledBtn label={t("buttons.paperwork6")} soon={soon} />
            </div>
          </Section>

          {/* ── Administration — light blue panel, subtle blue border ── */}
          <Section
            title={t("sections.administration")}
            accent="border-card-rim bg-card dark:border-purple-900 dark:bg-purple-950"
          >
            <div className="grid grid-cols-2 gap-3">
              <DisabledBtn label={t("buttons.users")} soon={soon} />
              <Link href="/admin/value-lists" className={activeLinkClass}>
                {t("buttons.referenceData")}
              </Link>
              <DisabledBtn label={t("buttons.importExport")} soon={soon} />
              <DisabledBtn label={t("buttons.settings")} soon={soon} />
            </div>
          </Section>

        </div>
      </main>
    </div>
  );
}
