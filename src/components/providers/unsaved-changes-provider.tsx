"use client";

/**
 * UnsavedChangesProvider — Slice #15.03, Change 1.
 *
 * Any detail form (Natural Person / Judicial Person / Property / Paperwork)
 * or Admin → Import classify panel can register itself as "dirty" via the
 * `useUnsavedChangesGuard` hook below. Sidebar navigation (and anything else
 * that wants to be guarded) then calls `guardedNavigate(href)` /
 * `guardedAction(fn)` instead of calling `router.push` directly — if
 * anything registered is currently dirty, a Save / Discard / Cancel dialog
 * is shown first; otherwise the action runs immediately.
 *
 * Implementation notes:
 * - The registry lives in a `useRef<Map<...>>`, not `useState`, so
 *   registering/unregistering a guard never triggers a re-render and is
 *   safe to do from a plain `useEffect` body (no `react-hooks/set-state-in-
 *   effect` violation — see CLAUDE.md's Slice #4.5 for the project's
 *   standing rule on this).
 * - `useUnsavedChangesGuard` accepts a plain `{ isDirty: boolean, onSave }`
 *   object and stores it in a ref that is mutated fresh on every render
 *   (also not a `setState` call) — callers never need to memoize `isDirty`.
 * - `onSave` must resolve `true` on a successful save and `false` (or
 *   throw) on failure; on success the queued navigation/action proceeds,
 *   on failure the dialog stays open and shows an error.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GuardHandlers = {
  isDirty: boolean;
  onSave: () => Promise<boolean>;
};

type GuardRegistryEntry = {
  isDirty: () => boolean;
  onSave: () => Promise<boolean>;
};

type UnsavedChangesContextValue = {
  registerGuard:   (id: string, entry: GuardRegistryEntry) => void;
  unregisterGuard: (id: string) => void;
  guardedAction:   (action: () => void) => void;
  guardedNavigate: (href: string) => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function useUnsavedChanges(): UnsavedChangesContextValue {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  }
  return ctx;
}

/**
 * Registers the calling component's dirty/save state with the nearest
 * UnsavedChangesProvider for the lifetime of the component.
 *
 * `isDirty` and `onSave` are read fresh from a ref on every check, so the
 * caller can simply pass the latest values on every render — no need to
 * memoize either one.
 */
export function useUnsavedChangesGuard(handlers: GuardHandlers): void {
  const { registerGuard, unregisterGuard } = useUnsavedChanges();

  // useId() gives a stable, unique-per-instance string with no impure
  // Math.random() call during render (React's "components must be pure"
  // rule flags Math.random() in the render body even when guarded by a
  // ref-null check).
  const id = useId();

  const handlersRef = useRef(handlers);
  // Keep the ref pointing at the latest handlers. This must run as a
  // commit-phase effect, not during render — mutating a ref's `.current`
  // while rendering is flagged by React's "no ref access during render"
  // purity rule. An effect with no dependency array runs after every
  // render, so the ref is always fresh by the time anything reads it.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  // Register once on mount, unregister on unmount. The entry closure
  // reads `handlersRef.current` fresh on every call, so it always sees the
  // latest isDirty/onSave without needing to re-register on every render.
  // Neither registerGuard nor unregisterGuard call setState (they mutate a
  // Map stored in a ref on the provider), so this effect never trips the
  // project's react-hooks/set-state-in-effect rule.
  useEffect(() => {
    const entry: GuardRegistryEntry = {
      isDirty: () => handlersRef.current.isDirty,
      onSave: () => handlersRef.current.onSave(),
    };
    registerGuard(id, entry);
    return () => unregisterGuard(id);
  }, [id, registerGuard, unregisterGuard]);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const t = useTranslations("shared.unsavedChanges");

  const registryRef = useRef<Map<string, GuardRegistryEntry>>(new Map());
  const pendingActionRef = useRef<(() => void) | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const registerGuard = useCallback((id: string, entry: GuardRegistryEntry) => {
    registryRef.current.set(id, entry);
  }, []);

  const unregisterGuard = useCallback((id: string) => {
    registryRef.current.delete(id);
  }, []);

  const getDirtyEntry = useCallback((): GuardRegistryEntry | null => {
    for (const entry of registryRef.current.values()) {
      if (entry.isDirty()) return entry;
    }
    return null;
  }, []);

  const guardedAction = useCallback(
    (action: () => void) => {
      if (!getDirtyEntry()) {
        action();
        return;
      }
      pendingActionRef.current = action;
      setSaveError(null);
      setDialogOpen(true);
    },
    [getDirtyEntry],
  );

  const guardedNavigate = useCallback(
    (href: string) => {
      guardedAction(() => {
        router.push(href);
      });
    },
    [guardedAction, router],
  );

  const handleCancel = useCallback(() => {
    pendingActionRef.current = null;
    setDialogOpen(false);
    setSaveError(null);
  }, []);

  const handleDiscard = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setDialogOpen(false);
    setSaveError(null);
    action?.();
  }, []);

  const handleSave = useCallback(async () => {
    const entry = getDirtyEntry();
    if (!entry) {
      handleDiscard();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const ok = await entry.onSave();
      if (ok) {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        setDialogOpen(false);
        action?.();
      } else {
        setSaveError(t("saveFailed"));
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [getDirtyEntry, handleDiscard, t]);

  const value = useMemo<UnsavedChangesContextValue>(
    () => ({ registerGuard, unregisterGuard, guardedAction, guardedNavigate }),
    [registerGuard, unregisterGuard, guardedAction, guardedNavigate],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      {dialogOpen && (
        <UnsavedChangesDialog
          onSave={handleSave}
          onDiscard={handleDiscard}
          onCancel={handleCancel}
          busy={saving}
          error={saveError}
        />
      )}
    </UnsavedChangesContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Dialog (Save / Discard / Cancel) — same visual template as the
// ConfirmDialog used throughout the app, extended to a third button.
// ---------------------------------------------------------------------------

function UnsavedChangesDialog({
  onSave,
  onDiscard,
  onCancel,
  busy,
  error,
}: {
  onSave:    () => void;
  onDiscard: () => void;
  onCancel:  () => void;
  busy:      boolean;
  error:     string | null;
}) {
  const t = useTranslations("shared.unsavedChanges");
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <h3
          id="unsaved-changes-title"
          className="text-base font-semibold text-ink dark:text-zinc-100"
        >
          {t("title")}
        </h3>
        <p className="mt-2 text-sm text-fade dark:text-zinc-400">{t("body")}</p>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={busy}
            className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-red-950/30"
          >
            {t("discard")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
