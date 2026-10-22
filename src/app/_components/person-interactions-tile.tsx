"use client";

/**
 * A person's „Interacțiuni" tile: the history (B) and, under it, the action panel (C).          (Slice #39.05)
 *
 * Adrian, 2026-10-11: „The Interactions functionality can be displayed as such: A) the log for all persons; B) the
 * log for one person — which is A) but filtered; C) the Action Panel where you can work with the interactions
 * functionality — it can be collapsed to one large button or expanded to show the entire action panel."
 *
 * B is `InteractionsTile` (#38.89), the person's history, newest first. C is the module's own log form, `LogTile`
 * (#38.85–#38.88) — REUSED, NOT COPIED: the same component the Rapoarte screen draws, with the person fixed and its
 * person picker hidden (`personFixed`). It stays under `src/app/interactions/_components/`: this composite lives
 * under `src/app/` too, so nothing has to move.
 *
 *   - C starts COLLAPSED to one full-width button, „Înregistrează o interacțiune", in the spec's indigo (Ask first 1).
 *     The address expands it — `?log=new` on a new record, `?log=<id>` on that row (`readLog`); 39.06's names link
 *     here. Expanding or collapsing writes nothing.
 *   - „Interacțiune nouă" in B expands C in place on a new record; a row in B chooses it into C (expanding C). With C
 *     expanded and typed into, both ask first, exactly as the Rapoarte screen does (`switchMove`).
 *   - „Restrânge" collapses C; a dirty C asks first through the app's guard (Ask first 2) — and LogTile's guard is
 *     the screen's unsaved change, so leaving the screen asks too.
 *   - B keeps the height it has today and C stands under it; the tile grows, 40 rem wide (Ask first 3).
 *   - In an Incursiune B is drawn alone (`incursion-tile.tsx`): no C and no button that writes (#38.72).
 */
import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronUp, SquarePen } from "lucide-react";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { InteractionsTile } from "@/components/tiles/interactions-tile";
import { useToast } from "@/components/toast";
import { IconButton } from "@/lib/ui/icon-button";
import { switchMove } from "@/lib/interactions/form";
import { LOG_PARAM, readLog } from "@/lib/interactions/links";
import { LogTile, type SwitchRequest } from "@/app/interactions/_components/log-tile";

export function PersonInteractionsTile({
  personId,
  personName,
  title,
  subtitle,
  surface,
}: {
  personId: string;
  personName: string;
  title: string;
  subtitle?: string;
  surface: string;
}) {
  const t = useTranslations("interactions");
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { guardedAction } = useUnsavedChanges();
  const { toast, show } = useToast();

  // What the address asks of C, read when it changes (a link to this same screen with ?log= moves C there).
  const asked = params.get(LOG_PARAM);
  const [expanded, setExpanded] = useState(() => readLog(asked).expanded);
  const [selectedId, setSelectedId] = useState<string | null>(() => readLog(asked).select);
  const [prevAsked, setPrevAsked] = useState(asked);
  if (prevAsked !== asked) {
    setPrevAsked(asked);
    const next = readLog(asked);
    if (next.expanded) {
      setExpanded(true);
      setSelectedId(next.select);
    }
  }

  const [request, setRequest] = useState<SwitchRequest | null>(null);
  const dirtyRef = useRef(false);
  const logRef = useRef<HTMLElement>(null);

  /** „Interacțiune nouă" (B's „+"): C expanded on a new record — after asking, if C is being typed into. */
  const requestNew = () => {
    if (!expanded) {
      setSelectedId(null);
      setExpanded(true);
      return;
    }
    const move = switchMove(dirtyRef.current, selectedId, null);
    if (move === "ask") setRequest({ kind: "new" });
    else if (move === "switch") setSelectedId(null);
  };
  /** A row of B: chosen into C, expanding it — after asking, if C is being typed into. */
  const requestSelect = (id: string) => {
    if (!expanded) {
      setSelectedId(id);
      setExpanded(true);
      return;
    }
    const move = switchMove(dirtyRef.current, selectedId, id);
    if (move === "ask") setRequest({ kind: "select", id });
    else if (move === "switch") setSelectedId(id);
  };
  const answer = (yes: boolean) => {
    if (yes && request) setSelectedId(request.kind === "select" ? request.id : null);
    setRequest(null);
  };
  // Ask first 2: collapsing a dirty C asks first, as leaving the screen does.
  const collapse = () => guardedAction(() => setExpanded(false));

  const onSaved = (_record: unknown, kind: "created" | "updated") => {
    show(t(kind === "created" ? "log.saved" : "log.updated"));
    void queryClient.invalidateQueries({ queryKey: ["interactions"] });
  };
  const onDeleted = () => {
    show(t("log.deleted"));
    void queryClient.invalidateQueries({ queryKey: ["interactions"] });
    setSelectedId(null);
  };

  const panel = expanded ? (
    <div className="mt-3 flex flex-col gap-2" data-person-log="expanded">
      <div className="flex justify-end">
        <IconButton icon={ChevronUp} label={t("log.collapse")} showLabel variant="secondary" size="xs" data-log-collapse="" onClick={collapse} />
      </div>
      <LogTile
        scope={personId}
        scopeName={personName}
        selectedId={selectedId}
        request={request}
        onRequest={answer}
        onModeNew={requestNew}
        onSaved={onSaved}
        onDeleted={onDeleted}
        dirtyRef={dirtyRef}
        tileRef={logRef}
        personFixed
      />
    </div>
  ) : (
    // Slice 40.33 (Adrian: „the "log interaction" button should have a size very similar to the "associate person" or
    // "associate property" on the Links tile; should be the same type of button … including the size and the colour"):
    // „Asociază …"'s kind — primary, sm, as wide as its words, at the tile's left (Ask first 3). It was one large indigo
    // („accent", #38.85) button stretched across the tile.
    <div className="mt-3 flex flex-col items-start" data-person-log="collapsed">
      <IconButton
        icon={SquarePen}
        label={t("screen.logTitle")}
        showLabel
        variant="primary"
        size="sm"
        data-log-expand=""
        onClick={() => {
          setSelectedId(null);
          setExpanded(true);
        }}
      />
    </div>
  );

  return (
    <>
      <InteractionsTile
        personId={personId}
        title={title}
        subtitle={subtitle}
        surface={surface}
        onNew={requestNew}
        onRow={requestSelect}
        selectedId={expanded ? selectedId : null}
        footer={panel}
      />
      {toast}
    </>
  );
}
