"use client";

/**
 * Login form — accepts username OR email.
 *
 * Flow:
 *  1. User submits username (or email) + password.
 *  2. If input looks like a username (no "@"), POST /api/auth/lookup-email to
 *     get the associated email from app_users.
 *  3. Call Supabase signInWithPassword with the email + password.
 *  4. On success, hard-navigate to "/" so the server layout picks up the new
 *     session cookie.
 *
 * All translation strings are passed as props from the server page component
 * to avoid SSR/client locale hydration mismatches.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LoginFormProps {
  labelIdentity: string;
  placeholderIdentity: string;
  labelPassword: string;
  buttonSignIn: string;
  buttonSigningIn: string;
  errorInvalidCredentials: string;
  errorGeneric: string;
}

export function LoginForm({
  labelIdentity,
  placeholderIdentity,
  labelPassword,
  buttonSignIn,
  buttonSigningIn,
  errorInvalidCredentials,
  errorGeneric,
}: LoginFormProps) {
  const router = useRouter();
  const [identity, setIdentity] = useState(""); // username or email
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let email = identity.trim();

      // If no "@" assume it's a username — look up the email
      if (!email.includes("@")) {
        const res = await fetch("/api/auth/lookup-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: email }),
        });
        if (!res.ok) {
          const { error: msg } = await res.json();
          setError(msg ?? errorInvalidCredentials);
          return;
        }
        const { email: found } = await res.json();
        email = found;
      }

      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(errorInvalidCredentials);
        return;
      }

      // Hard navigation so the server middleware sees the new session cookie
      router.push("/");
      router.refresh();
    } catch {
      setError(errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="identity" className="text-sm font-medium text-ink">
          {labelIdentity}
        </label>
        <input
          id="identity"
          type="text"
          autoComplete="username"
          required
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          className="rounded-md border border-wire bg-base px-3 py-2 text-sm text-ink outline-none focus:border-cta focus:ring-1 focus:ring-cta transition"
          placeholder={placeholderIdentity}
          disabled={loading}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          {labelPassword}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-wire bg-base px-3 py-2 text-sm text-ink outline-none focus:border-cta focus:ring-1 focus:ring-cta transition"
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-cta px-4 py-2 text-sm font-semibold text-white hover:bg-cta/90 disabled:opacity-60 transition"
      >
        {loading ? buttonSigningIn : buttonSignIn}
      </button>
    </form>
  );
}
