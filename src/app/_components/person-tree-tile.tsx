"use client";

/**
 * A natural person's „Arbore de moștenire" tile: the person's tree (B) and, under it, the action panel (C).
 *                                                                                       (Slice #39.12)
 *
 * Adrian (The Inheritance Tree.docx): „a tile with a limited inheritance tree for only 1 person … great grandparents
 * all the way to siblings and children"; „a square the size of the identity tile"; „light blue as light as the other
 * coloured tiles"; „an Action Panel that can perform work on the inheritance tree that shows up collapsed when the
 * form was reached from the Person list and shows up expanded when the form was reached by clicking the person link".
 *
 * B is the whole tree's drawing (`TreeCanvas`, #39.11) over `personSubtree` — up to great-grandparents, down to
 * great-grandchildren, the siblings and every spouse — the person ringed in amber, in a square as wide as the tile:
 * 2 units for one or two persons, 3 for more (41.71, tile-size.ts; it was „Identitate"'s width). „Deschide arborele
 * întreg" opens A centred on the person — since 41.87 over this screen, grown out of the tile and back into it, as
 * „Hartă extinsă" is (whole-tree-overlay.tsx). #39.13: each person's documents badge, as
 * in A; the year slider and „Acte comune" are A's alone — the tile stays the person's family at a glance.
 *
 * C, the same A/B/C pattern as „Interacțiuni" (#39.05). 41.72 split it in two, each behind its own button: „Adaugă o
 * rudă" (a person with a chain link) opens the half that adds one — a person, and the role they hold towards this one;
 * „Scoate o rudă" (a person with a bin) the half that lists the person's own family ties, each with „Scoate". Both may
 * be open, the ties above; each has its own collapse, and pressing its button again closes it. `?tree=open` opens the
 * add half — a name in the whole tree links there (`personTreeHref`). Opening writes nothing. C writes ONLY through
 * the association route that exists (POST/DELETE /api/people/<id>/references, „Asociază persoană"'s), offering only
 * the roles with a kinship (#39.10). An add half typed into is the screen's unsaved change.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, Link as LinkIcon, Maximize2, Plus, Trash2 } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { ENTITY_ICON } from "@/lib/ui/entity-icon";
import { useToast } from "@/components/toast";
import { useUnsavedChanges, useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import { layoutTree, type TreePerson } from "@/lib/inheritance/layout";
import { familyRoles, personSubtree } from "@/lib/inheritance/subtree";
import { treeTileOpeningScale, treeTileUnits } from "@/lib/inheritance/tile-size";
import { indexDocuments } from "@/lib/inheritance/documents";
import { TREE_PARAM, readTree } from "@/lib/inheritance/links";
import { roleHeldBy, personRoleShown } from "@/lib/persons/relation-roles";
import { TreeCanvas, type TreeControl } from "@/components/inheritance/tree-canvas";
import { useWholeTree } from "./whole-tree-overlay";
import { fetchTree } from "@/app/inheritance-tree/_components/inheritance-tree-screen";
import { unitStyle } from "@/lib/ui/field-widths";
import { TileTitle } from "@/components/tiles/tile-title";

type Role = { id: string; name: string; validForPerson?: boolean | null; kinship?: string | null };
type Found = { id: string; displayName: string };

/** A person's screen, plainly: the tile's names (C stays collapsed there, as from a list). */
const plainHref = (id: string) => `/natural-persons/${encodeURIComponent(id)}`;

export function PersonTreeTile({
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
  const t = useTranslations("inheritance.tile");
  const params = useSearchParams();
  const asked = readTree(params?.get(TREE_PARAM) ?? null);
  // 41.72: two halves, each its own button's; `?tree=open` opens the add half (Ask first 4).
  const [addOpen, setAddOpen] = useState(asked);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [prevAsked, setPrevAsked] = useState(asked);
  if (prevAsked !== asked) {
    setPrevAsked(asked);
    if (asked) setAddOpen(true);
  }
  const { guardedAction } = useUnsavedChanges();

  const q = useQuery({ queryKey: ["inheritance-tree"], queryFn: fetchTree });
  const sub = useMemo(() => (q.data ? personSubtree(personId, q.data.persons, q.data.ties) : null), [q.data, personId]);
  const layout = useMemo(() => (sub ? layoutTree(sub.persons, sub.ties) : null), [sub]);
  const docs = useMemo(() => (q.data ? indexDocuments(q.data.documents ?? [], q.data.appearances ?? []) : null), [q.data]);
  // 41.71: as wide as its family — 2 units for one or two persons (and while loading), 3 for more; the drawing opens at
  // level 2 or 1 to match (tile-size.ts). Read again when a tie comes or goes, so the width follows the family.
  // 41.79 (Ask first 2): the persons the drawing places — the count of what is drawn, not of what was asked for.
  const count = layout ? layout.nodes.length : null;
  const units = treeTileUnits(count);
  const opening = useCallback((fit: number) => treeTileOpeningScale(count ?? 0, fit), [count]);
  // 41.87: the whole tree grows out of this drawing and back into it.
  const canvasBox = useRef<HTMLDivElement>(null);
  const canvasControl = useRef<TreeControl | null>(null);
  const wholeButton = useRef<HTMLButtonElement>(null);
  const whole = useWholeTree({ personId, tileBox: canvasBox, tileControl: canvasControl, button: wholeButton });

  return (
    <section data-tile="inheritanceTree" aria-label={title} className={`max-w-full ${surface}`} style={unitStyle(units)} data-tree-tile-units={units}>
      {/* Slice 40.06: the title and its one-line subtitle are every tile's (TileTitle); „Deschide arborele întreg"
          stays at the right of the title's line, beside the heading rather than inside it. */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <TileTitle title={title} subtitle={subtitle} className="flex-1" />
        {/* 41.87: a button now — the whole tree opens over this screen (it was a link to /inheritance-tree?focus=). */}
        <IconButton ref={wholeButton} icon={Maximize2} label={t("wholeTree")} variant="secondary" size="sm" aria-expanded={whole.shown} data-tree-whole="" onClick={whole.open} />
      </div>
      <div ref={canvasBox} className="relative aspect-square w-full overflow-hidden rounded-md border border-card-pinned-rim bg-white/70 dark:border-card-pinned-rim-dark dark:bg-zinc-950" data-tree-tile-canvas="">
        {q.isLoading && <p className="p-3 text-xs text-fade">{t("loading")}</p>}
        {q.isError && <p role="alert" className="p-3 text-xs text-red-600">{t("error")}</p>}
        {layout && layout.nodes.length === 0 && <p className="p-3 text-xs text-fade">{t("empty")}</p>}
        {sub && layout && layout.nodes.length > 0 && (
          // A new width is a new first view: keyed on the units, the drawing fits its new square again — 41.79: centred
          // on the screen's own person (Ask firsts 3, 4).
          <TreeCanvas key={units} data={sub} layout={layout} mark={personId} linkOf={plainHref} docs={docs} openingScale={opening} openingCentre={personId} controlRef={canvasControl} className="absolute inset-0" />
        )}
      </div>
      {/* 41.72 (Adrian: „This button should be replaced with two buttons"): where the one button stood (40.34), side by
          side, primary and sm — „Adaugă o rudă" first. Each stays on screen while its half is open, shown pressed;
          pressed again, it closes the half. The line between the halves only when both are open (Ask firsts 2, 3). */}
      <div className="mt-3 flex flex-col gap-3" data-tree-panel={addOpen || removeOpen ? "expanded" : "collapsed"}>
        <div className="flex items-start gap-2" data-tree-buttons="">
          {/* 41.80 (Adrian: „similar to the first button on Links Tile but the two icons should be switched"): drawn as
              „Asociază persoană" draws its two — icon and secondIcon, each at the button's icon size — the person
              first, then the chain; „Scoate o rudă" the person, then the bin. */}
          <IconButton
            icon={ENTITY_ICON.natural}
            secondIcon={LinkIcon}
            label={t("addRelative")}
            variant="primary"
            size="sm"
            aria-pressed={addOpen}
            data-tree-add=""
            onClick={() => (addOpen ? guardedAction(() => setAddOpen(false)) : setAddOpen(true))}
          />
          <IconButton
            icon={ENTITY_ICON.natural}
            secondIcon={Trash2}
            label={t("removeRelative")}
            variant="primary"
            size="sm"
            aria-pressed={removeOpen}
            data-tree-remove=""
            onClick={() => setRemoveOpen((o) => !o)}
          />
        </div>
        {removeOpen && <RemoveHalf personId={personId} onCollapse={() => setRemoveOpen(false)} />}
        {addOpen && (
          <AddHalf personId={personId} personName={personName} lined={removeOpen} onCollapse={() => guardedAction(() => setAddOpen(false))} />
        )}
      </div>
      {whole.overlay}
    </section>
  );
}

/** A half's own collapse, at its top right. */
function HalfCollapse({ which, onCollapse }: { which: "add" | "remove"; onCollapse: () => void }) {
  const t = useTranslations("inheritance.tile");
  return <IconButton icon={ChevronUp} label={t("collapse")} variant="secondary" size="xs" data-tree-collapse={which} onClick={onCollapse} />;
}

/** „Scoate o rudă"'s half: the person's own family ties, each with „Scoate" and its confirmation. */
function RemoveHalf({ personId, onCollapse }: { personId: string; onCollapse: () => void }) {
  const t = useTranslations("inheritance.tile");
  const qc = useQueryClient();
  const { toast, show } = useToast();
  const tree = useQuery({ queryKey: ["inheritance-tree"], queryFn: fetchTree });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  // The person's own ties, as the tile names them: the other person and what they are to this one.
  const byId = useMemo(() => new Map((tree.data?.persons ?? []).map((p) => [p.id, p])), [tree.data]);
  const mine = (tree.data?.ties ?? [])
    .filter((x) => x.personIdA === personId || x.personIdB === personId)
    .map((x) => {
      const otherId = x.personIdA === personId ? x.personIdB : x.personIdA;
      const p: TreePerson | undefined = byId.get(otherId);
      const shown = personRoleShown(x.role, roleHeldBy(otherId, x.personIdA, x.roleReadsAToB), p?.gender ?? null);
      return { id: x.id, otherId, name: p?.displayName ?? "…", word: shown.kind === "role" ? shown.name : x.role.name };
    });

  const remove = async (otherId: string) => {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(personId)}/references/${encodeURIComponent(otherId)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`references ${res.status}`);
      setConfirm(null);
      show(t("removed"));
      await qc.invalidateQueries();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1" data-tree-half="remove">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-ink dark:text-zinc-300">{t("tiesTitle")}</span>
        <HalfCollapse which="remove" onCollapse={onCollapse} />
      </div>
      {mine.length === 0 ? (
        <p className="text-xs text-fade">{t("noTies")}</p>
      ) : (
        <ul className="flex flex-col gap-1" data-tree-ties="">
          {mine.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm" data-tree-tie={m.otherId}>
              <span>
                <span className="text-fade">{m.word} — </span>
                {m.name}
              </span>
              {confirm === m.otherId ? (
                <span className="flex items-center gap-1" role="group" aria-label={t("removeConfirm", { name: m.name })}>
                  <span className="text-xs text-ink">{t("removeConfirm", { name: m.name })}</span>
                  <IconButton icon={Trash2} label={t("removeYes")} variant="danger" size="xs" busy={busy} onClick={() => void remove(m.otherId)} />
                  <IconButton icon={ChevronUp} label={t("removeNo")} variant="secondary" size="xs" onClick={() => setConfirm(null)} />
                </span>
              ) : (
                <IconButton icon={Trash2} label={t("remove", { name: m.name })} variant="secondary" size="xs" onClick={() => setConfirm(m.otherId)} />
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t("error")}</p>}
      {toast}
    </div>
  );
}

/** „Adaugă o rudă"'s half: one more relative — a person, and the role they hold towards this one. */
function AddHalf({ personId, personName, lined, onCollapse }: { personId: string; personName: string; lined: boolean; onCollapse: () => void }) {
  const t = useTranslations("inheritance.tile");
  const qc = useQueryClient();
  const { toast, show } = useToast();
  const roles = useQuery({
    queryKey: ["value-list", "person-roles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/value-lists/person-roles");
      // A redirect is the sign-in page, not the list (person-role-flags.test.ts reads every caller for this).
      if (res.redirected || !res.ok) throw new Error(`person-roles ${res.status}`);
      return ((await res.json()) as { items: Role[] }).items;
    },
  });
  const offered = useMemo(() => familyRoles(roles.data ?? []), [roles.data]);

  const [text, setText] = useState("");
  const [other, setOther] = useState<Found | null>(null);
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const found = useQuery({
    queryKey: ["tree-person-search", text],
    enabled: text.trim().length >= 2,
    queryFn: async () => {
      const res = await fetch(`/api/people?q=${encodeURIComponent(text.trim())}&limit=8`);
      if (!res.ok) throw new Error(`people ${res.status}`);
      return ((await res.json()) as { items: Found[] }).items.filter((p) => p.id !== personId);
    },
  });

  const dirty = other !== null || roleId !== "";
  const add = async (): Promise<boolean> => {
    if (!other || !roleId) return false;
    setBusy(true);
    setError(false);
    try {
      // „Asociază persoană"'s route: the person ticked (`other`) holds the role towards this one.
      const res = await fetch(`/api/people/${encodeURIComponent(personId)}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personIds: [other.id], relationshipRoleId: roleId }),
      });
      if (!res.ok) throw new Error(`references ${res.status}`);
      setOther(null);
      setRoleId("");
      setText("");
      show(t("added"));
      await qc.invalidateQueries();
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  };
  useUnsavedChangesGuard({ isDirty: dirty, onSave: add });

  return (
    <fieldset className={`relative flex flex-col gap-2${lined ? " border-t border-crease pt-3 dark:border-zinc-700" : ""}`} data-tree-half="add">
      {/* The legend stays the fieldset's first child — its name; the collapse sits at the top right over it. */}
      <legend className="pr-8 text-xs font-medium text-ink dark:text-zinc-300">{t("addTitle", { name: personName })}</legend>
      <div className={`absolute right-0 ${lined ? "top-3" : "top-0"}`}>
        <HalfCollapse which="add" onCollapse={onCollapse} />
      </div>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-fade">{t("personLabel")}</span>
        <input
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOther(null);
          }}
          placeholder={t("searchPlaceholder")}
          className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      {text.trim().length >= 2 && !other && (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto" role="radiogroup" aria-label={t("personLabel")}>
          {(found.data ?? []).length === 0 && !found.isLoading && <p className="text-xs text-fade">{t("noResults")}</p>}
          {(found.data ?? []).map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="tree-relative" checked={false} onChange={() => setOther(p)} />
              {p.displayName}
            </label>
          ))}
        </div>
      )}
      {other && <p className="text-sm" data-tree-chosen="">{other.displayName}</p>}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-fade">{t("roleLabel", { name: personName })}</span>
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="w-fit rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">{t("rolePick")}</option>
          {offered.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <IconButton icon={Plus} label={t("add")} variant="primary" size="sm" busy={busy} disabled={!other || !roleId} onClick={() => void add()} />
      </div>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t("error")}</p>}
      {toast}
    </fieldset>
  );
}
