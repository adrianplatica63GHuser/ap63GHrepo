"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Reply, Search, SquarePen, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { screenBox } from "@/lib/ui/field-widths";
import { useSessionValue } from "@/lib/ui/use-session-value";
import { useNameOr } from "@/components/record/use-name-or";
import {
  DEFAULT_FILTERS,
  DEFAULT_ORDER_STATE,
  listQuery,
  needsReplyFilters,
  readOrder,
  type InteractionFilters,
  type InteractionOrder,
} from "@/lib/interactions/filters";
import { PAGE_DEFAULT } from "@/lib/interactions/model";
import type { InteractionRecord } from "@/lib/interactions/model";
import { switchMove } from "@/lib/interactions/form";
import { useToast } from "@/components/toast";
import { HistoryTile, type HistoryPage } from "./history-tile";
import { LogTile, type SwitchRequest } from "./log-tile";

/** How long a saved row keeps its flash mark (the animation is 1.4 s). */
const FLASH_MS = 1500;

/** The order chosen, kept for the browser session (§8.3). */
const ORDER_KEY = "ga.interactions.order";

/**
 * „Interacțiuni" — the module's working surface (§2).   (Slice #38.84)
 *
 * A thin module bar (not a third tile) answers „whose history am I looking at?": the title, the scope („Toți
 * clienții" or one person), a search on person and subject, how many interactions the view holds and the
 * „Așteaptă răspuns" counter. Under it two cards: the history, about 62 % of the width, and the log tile — side by
 * side once the module has 1100 px, stacked under that, history first.
 *
 * THE SCOPE IS THE ADDRESS (`?person=<id>`), so the person's tile (38.89) can open the screen scoped; the toolbar's
 * person search and the „Persoană" column filter change it. Everything else is the one filter state
 * (`src/lib/interactions/filters.ts`), and the order is kept for the session.
 */
export function InteractionsScreen() {
  const t = useTranslations("interactions");
  const nameOr = useNameOr();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const scope = params.get("person");

  const [filters, setFiltersState] = useState<InteractionFilters>(DEFAULT_FILTERS);
  const [orderRaw, setOrderRaw] = useSessionValue(ORDER_KEY);
  const order = useMemo(() => readOrder(orderRaw), [orderRaw]);
  const [page, setPage] = useState(0);
  // 38.89: the person's tile opens the screen with a row chosen (?select=<id>) or a new record ready (?new=1).
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get("select"));
  const wantNew = params.get("new") === "1";
  const [flashId, setFlashId] = useState<string | null>(null);
  const [request, setRequest] = useState<SwitchRequest | null>(null);
  const logRef = useRef<HTMLElement>(null);
  const dirtyRef = useRef(false);
  const queryClient = useQueryClient();
  const { toast, show } = useToast();

  // A filter changed: back to the first page. (Plain functions: the React Compiler memoizes them.)
  const setFilters = (next: InteractionFilters) => {
    setFiltersState(next);
    setPage(0);
  };
  const setOrder = (next: InteractionOrder) => {
    setOrderRaw(JSON.stringify(next));
    setPage(0);
  };
  const reset = () => {
    setFiltersState(DEFAULT_FILTERS);
    setOrderRaw(JSON.stringify(DEFAULT_ORDER_STATE));
    setPage(0);
  };
  const setScope = (personId: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (personId) next.set("person", personId);
    else next.delete("person");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    setPage(0);
  };

  // The search waits for the typing to settle before it asks.
  const deferred = useDeferredValue(filters);
  const query = listQuery(deferred, order, scope, page, PAGE_DEFAULT, new Date()).toString();
  const history = useQuery<HistoryPage>({
    queryKey: ["interactions", query],
    queryFn: async () => {
      const res = await fetch(`/api/interactions?${query}`);
      if (!res.ok || res.redirected) throw new Error(`interactions ${res.status}`);
      return (await res.json()) as HistoryPage;
    },
  });

  const person = useQuery<{ person: { displayName: string | null } }>({
    queryKey: ["person", scope],
    enabled: scope !== null,
    queryFn: async () => {
      const res = await fetch(`/api/people/${encodeURIComponent(scope as string)}`);
      if (!res.ok || res.redirected) throw new Error(`person ${res.status}`);
      return (await res.json()) as { person: { displayName: string | null } };
    },
  });
  const scopeName = scope ? (person.data ? nameOr(person.data.person.displayName, "person") : "…") : null;
  const needsReply = history.data?.needsReply ?? 0;

  // ?new=1 (38.89): the form, ready — scrolled to and its first choice focused. A focus, nothing written.
  useEffect(() => {
    if (!wantNew) return;
    logRef.current?.scrollIntoView({ block: "start" });
    document.getElementById("interaction-channel-first")?.focus({ preventScroll: true });
  }, [wantNew]);

  // „Exportă" (38.88): the list's own query without its page, and the browser's time zone for the dates. The answer
  // is an attachment, so the browser saves it and the screen stays where it is.
  const exportRows = () => {
    const p = listQuery(filters, order, scope, 0, PAGE_DEFAULT, new Date());
    p.delete("limit");
    p.delete("offset");
    p.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
    window.location.assign(`/api/interactions/export?${p.toString()}`);
  };

  // To the form: the empty log's button and, under 1100 px, the sticky one (§2).
  const logFirst = () => {
    logRef.current?.scrollIntoView({ block: "start" });
    document.getElementById("interaction-channel-first")?.focus({ preventScroll: true });
  };

  // Selection is the link between the tiles (§2): a row chosen loads into the log tile — after asking, if what is
  // there was being typed (38.87).
  const requestSelect = (id: string) => {
    const move = switchMove(dirtyRef.current, selectedId, id);
    if (move === "ask") setRequest({ kind: "select", id });
    else if (move === "switch") setSelectedId(id);
  };
  const requestNew = () => {
    const move = switchMove(dirtyRef.current, selectedId, null);
    if (move === "ask") setRequest({ kind: "new" });
    else if (move === "switch") setSelectedId(null);
  };
  const answer = (yes: boolean) => {
    if (yes && request) setSelectedId(request.kind === "select" ? request.id : null);
    setRequest(null);
  };
  const onDeleted = () => {
    show(t("log.deleted"));
    void queryClient.invalidateQueries({ queryKey: ["interactions"] });
    setSelectedId(null);
  };

  // A record saved (§4): the toast, the history asked again, and the row flashing where it lands.
  const onSaved = (record: InteractionRecord, kind: "created" | "updated") => {
    show(t(kind === "created" ? "log.saved" : "log.updated"));
    void queryClient.invalidateQueries({ queryKey: ["interactions"] });
    setFlashId(record.id);
    setTimeout(() => setFlashId((id) => (id === record.id ? null : id)), FLASH_MS);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* The module bar (§2). */}
      <header data-interactions-bar="" className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-zinc-100">{t("title")}</h1>
          <p className="flex items-center gap-1 text-sm text-fade dark:text-zinc-400" data-interactions-scope={scope ?? ""}>
            {scopeName ?? t("screen.scopeAll")}
            {scope && <IconButton icon={X} label={t("screen.scopeClear")} variant="bare" size="xs" onClick={() => setScope(null)} />}
          </p>
        </div>
        <label className="relative flex items-center">
          <span className="sr-only">{t("screen.searchLabel")}</span>
          <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-2.5 text-fade dark:text-zinc-400" />
          <input
            type="search"
            value={filters.q}
            placeholder={t("screen.search")}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            data-interactions-search=""
            className="rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-fade dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            {...screenBox("interactionSearch")}
          />
        </label>
        <span className="text-sm text-ink dark:text-zinc-200" data-interactions-count={history.data?.total ?? ""} aria-live="polite">
          {history.data ? t("screen.count", { count: history.data.total }) : ""}
        </span>
        <IconButton
          icon={Reply}
          label={t("screen.needsReply", { count: needsReply })}
          showLabel
          variant="attention-outline"
          size="md"
          disabled={needsReply === 0}
          data-needs-reply={needsReply}
          onClick={() => setFilters(needsReplyFilters(filters))}
        />
      </header>

      {/* The two tiles (§2): side by side from 1100 px of module, stacked under it, history first. */}
      <div className="@container">
        <div className="flex flex-col gap-4 @min-[1100px]:flex-row @min-[1100px]:items-start">
          <div className="min-w-0 @min-[1100px]:w-[62%] @min-[1100px]:shrink-0">
            <HistoryTile
              filters={filters}
              onFilters={setFilters}
              order={order}
              onOrder={setOrder}
              onReset={reset}
              scope={scope}
              scopeName={scopeName}
              onScope={setScope}
              data={history.data}
              isPending={history.isPending}
              isError={history.isError}
              onRetry={() => void history.refetch()}
              page={page}
              pageSize={PAGE_DEFAULT}
              onPage={setPage}
              selectedId={selectedId}
              onSelect={requestSelect}
              onLogFirst={logFirst}
              flashId={flashId}
              onExport={exportRows}
            />
            {/* §2: stacked, the form is a long scroll away — this button stays at the bottom of the view. */}
            <div data-log-sticky="" className="sticky bottom-4 z-20 mt-3 flex justify-end @min-[1100px]:hidden">
              <IconButton icon={SquarePen} label={t("log.sticky")} showLabel variant="accent" size="md" onClick={logFirst} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <LogTile
              scope={scope}
              scopeName={scopeName}
              selectedId={selectedId}
              request={request}
              onRequest={answer}
              onModeNew={requestNew}
              onSaved={onSaved}
              onDeleted={onDeleted}
              dirtyRef={dirtyRef}
              tileRef={logRef}
            />
          </div>
        </div>
      </div>
      {toast}
    </div>
  );
}
