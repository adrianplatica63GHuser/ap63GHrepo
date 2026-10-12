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
 * great-grandchildren, the siblings and every spouse — the person ringed in amber, in a square as wide as the
 * „Identitate" tile. „Deschide arborele întreg" opens A centred on the person.
 *
 * C, the same A/B/C pattern as „Interacțiuni" (#39.05): collapsed to one large button; `?tree=open` expands it — a
 * name in the whole tree links there (`personTreeHref`). Expanding writes nothing. C lists the person's own family
 * ties, each with „Scoate", and adds one: a person, and the role they hold towards this one. It writes ONLY through
 * the association route that exists (POST/DELETE /api/people/<id>/references, „Asociază persoană"'s), offering only
 * the roles with a kinship (#39.10). A C typed into is the screen's unsaved change.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, Maximize2, Plus, Trash2, Users } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useToast } from "@/components/toast";
import { useUnsavedChanges, useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import { layoutTree, type TreePerson } from "@/lib/inheritance/layout";
import { familyRoles, personSubtree } from "@/lib/inheritance/subtree";
import { TREE_PARAM, readTree, wholeTreeHref } from "@/lib/inheritance/links";
import { roleHeldBy, personRoleShown } from "@/lib/persons/relation-roles";
import { TreeCanvas } from "@/components/inheritance/tree-canvas";
import { fetchTree } from "@/app/inheritance-tree/_components/inheritance-tree-screen";
import { unitStyle } from "@/lib/ui/field-widths";

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
  units,
}: {
  personId: string;
  personName: string;
  title: string;
  subtitle?: string;
  surface: string;
  /** The „Identitate" tile's width, in units: the tile is that wide, its drawing that tall. */
  units: number;
}) {
  const t = useTranslations("inheritance.tile");
  const params = useSearchParams();
  const asked = readTree(params?.get(TREE_PARAM) ?? null);
  const [expanded, setExpanded] = useState(asked);
  const [prevAsked, setPrevAsked] = useState(asked);
  if (prevAsked !== asked) {
    setPrevAsked(asked);
    if (asked) setExpanded(true);
  }
  const { guardedAction } = useUnsavedChanges();

  const q = useQuery({ queryKey: ["inheritance-tree"], queryFn: fetchTree });
  const sub = useMemo(() => (q.data ? personSubtree(personId, q.data.persons, q.data.ties) : null), [q.data, personId]);
  const layout = useMemo(() => (sub ? layoutTree(sub.persons, sub.ties) : null), [sub]);

  return (
    <section data-tile="inheritanceTree" aria-label={title} className={`max-w-full ${surface}`} style={unitStyle(units)}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink dark:text-zinc-100">{title}</h2>
          {subtitle && <p className="text-xs text-fade dark:text-zinc-400">{subtitle}</p>}
        </div>
        <IconButton href={wholeTreeHref(personId)} icon={Maximize2} label={t("wholeTree")} variant="secondary" size="sm" data-tree-whole="" />
      </div>
      <div className="relative aspect-square w-full overflow-hidden rounded-md border border-card-family-rim bg-white/70 dark:border-card-family-rim-dark dark:bg-zinc-950" data-tree-tile-canvas="">
        {q.isLoading && <p className="p-3 text-xs text-fade">{t("loading")}</p>}
        {q.isError && <p role="alert" className="p-3 text-xs text-red-600">{t("error")}</p>}
        {layout && layout.nodes.length === 0 && <p className="p-3 text-xs text-fade">{t("empty")}</p>}
        {sub && layout && layout.nodes.length > 0 && (
          <TreeCanvas data={sub} layout={layout} mark={personId} linkOf={plainHref} className="absolute inset-0" />
        )}
      </div>
      {expanded ? (
        <FamilyPanel personId={personId} personName={personName} onCollapse={() => guardedAction(() => setExpanded(false))} />
      ) : (
        // One large button, as „Interacțiuni"'s C (#39.05), stretched across the tile.
        <div className="mt-3 flex flex-col" data-tree-panel="collapsed">
          <IconButton icon={Users} label={t("open")} showLabel variant="accent" size="lg" data-tree-expand="" onClick={() => setExpanded(true)} />
        </div>
      )}
    </section>
  );
}

/** C, expanded: the person's own family ties, and one more to add. */
function FamilyPanel({ personId, personName, onCollapse }: { personId: string; personName: string; onCollapse: () => void }) {
  const t = useTranslations("inheritance.tile");
  const qc = useQueryClient();
  const { toast, show } = useToast();
  const tree = useQuery({ queryKey: ["inheritance-tree"], queryFn: fetchTree });
  const roles = useQuery({
    queryKey: ["value-list", "person-roles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/value-lists/person-roles");
      if (!res.ok) throw new Error(`person-roles ${res.status}`);
      return ((await res.json()) as { items: Role[] }).items;
    },
  });
  const offered = useMemo(() => familyRoles(roles.data ?? []), [roles.data]);

  const [text, setText] = useState("");
  const [other, setOther] = useState<Found | null>(null);
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const found = useQuery({
    queryKey: ["tree-person-search", text],
    enabled: text.trim().length >= 2,
    queryFn: async () => {
      const res = await fetch(`/api/people?q=${encodeURIComponent(text.trim())}&limit=8`);
      if (!res.ok) throw new Error(`people ${res.status}`);
      return ((await res.json()) as { items: Found[] }).items.filter((p) => p.id !== personId);
    },
  });

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
    <div className="mt-3 flex flex-col gap-3" data-tree-panel="expanded">
      <div className="flex justify-end">
        <IconButton icon={ChevronUp} label={t("collapse")} showLabel variant="secondary" size="xs" data-tree-collapse="" onClick={onCollapse} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink dark:text-zinc-300">{t("tiesTitle")}</span>
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
                    <IconButton icon={Trash2} label={t("removeYes")} showLabel variant="danger" size="xs" busy={busy} onClick={() => void remove(m.otherId)} />
                    <IconButton icon={ChevronUp} label={t("removeNo")} variant="secondary" size="xs" onClick={() => setConfirm(null)} />
                  </span>
                ) : (
                  <IconButton icon={Trash2} label={t("remove", { name: m.name })} variant="secondary" size="xs" onClick={() => setConfirm(m.otherId)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <fieldset className="flex flex-col gap-2 border-t border-crease pt-3 dark:border-zinc-700">
        <legend className="text-xs font-medium text-ink dark:text-zinc-300">{t("addTitle", { name: personName })}</legend>
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
          <IconButton icon={Plus} label={t("add")} showLabel variant="primary" size="sm" busy={busy} disabled={!other || !roleId} onClick={() => void add()} />
        </div>
        {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t("error")}</p>}
      </fieldset>
      {toast}
    </div>
  );
}
