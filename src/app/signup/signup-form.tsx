"use client";

/**
 * All translation strings are passed as props from the server page component
 * to avoid SSR/client locale hydration mismatches.
 */
import { useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

interface SignupFormProps {
  labelEmail: string;
  labelUsername: string;
  hintUsername: string;
  buttonSubmit: string;
  buttonSubmitting: string;
  errorGeneric: string;
  errorUnexpected: string;
  successTitle: string;
  successMessage: string;
}

export function SignupForm({
  labelEmail,
  labelUsername,
  hintUsername,
  buttonSubmit,
  buttonSubmitting,
  errorGeneric,
  errorUnexpected,
  successTitle,
  successMessage,
}: SignupFormProps) {
  const [email, setEmail]       = useState("");
  const [username, setUsername] = useState("");
  const [state, setState]       = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/signup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), username: username.trim() }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        setErrorMsg(error ?? errorGeneric);
        setState("error");
        return;
      }

      setState("success");
    } catch {
      setErrorMsg(errorUnexpected);
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="text-center py-4">
        <div className="text-3xl mb-3">✉️</div>
        <h3 className="font-semibold text-ink mb-1">{successTitle}</h3>
        <p className="text-sm text-fade">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-ink">
          {labelEmail}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-wire bg-base px-3 py-2 text-sm text-ink outline-none focus:border-cta focus:ring-1 focus:ring-cta transition"
          placeholder="you@example.com"
          disabled={state === "submitting"}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm font-medium text-ink">
          {labelUsername}
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          required
          minLength={3}
          maxLength={40}
          pattern="[a-zA-Z0-9_\-]+"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-md border border-wire bg-base px-3 py-2 text-sm text-ink outline-none focus:border-cta focus:ring-1 focus:ring-cta transition"
          placeholder="your_username"
          disabled={state === "submitting"}
        />
        <p className="text-xs text-fade">{hintUsername}</p>
      </div>

      {state === "error" && errorMsg && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="rounded-md bg-cta px-4 py-2 text-sm font-semibold text-white hover:bg-cta/90 disabled:opacity-60 transition"
      >
        {state === "submitting" ? buttonSubmitting : buttonSubmit}
      </button>
    </form>
  );
}
