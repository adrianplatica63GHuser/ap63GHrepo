"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type State = "idle" | "saving" | "success" | "error";

export function ChangePasswordForm() {
  const router         = useRouter();
  const [newPwd, setNewPwd]         = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [state, setState]           = useState<State>("idle");
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (newPwd.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setState("saving");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) {
        setErrorMsg(error.message);
        setState("error");
        return;
      }
      setState("success");
      setTimeout(() => router.push("/"), 2000);
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="text-center py-4">
        <div className="text-3xl mb-2">✓</div>
        <p className="font-semibold text-ink">Password updated!</p>
        <p className="text-sm text-fade mt-1">Redirecting…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="new-pwd" className="text-sm font-medium text-ink">
          New Password
        </label>
        <input
          id="new-pwd"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
          className="rounded-md border border-wire bg-base px-3 py-2 text-sm text-ink outline-none focus:border-cta focus:ring-1 focus:ring-cta transition"
          disabled={state === "saving"}
        />
        <p className="text-xs text-fade">Minimum 8 characters.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirm-pwd" className="text-sm font-medium text-ink">
          Confirm Password
        </label>
        <input
          id="confirm-pwd"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPwd}
          onChange={(e) => setConfirmPwd(e.target.value)}
          className="rounded-md border border-wire bg-base px-3 py-2 text-sm text-ink outline-none focus:border-cta focus:ring-1 focus:ring-cta transition"
          disabled={state === "saving"}
        />
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {errorMsg}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={state === "saving"}
          className="flex-1 rounded-md bg-cta px-4 py-2 text-sm font-semibold text-white hover:bg-cta/90 disabled:opacity-60 transition"
        >
          {state === "saving" ? "Saving…" : "Update Password"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-wire px-4 py-2 text-sm font-medium text-ink hover:bg-surface transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
