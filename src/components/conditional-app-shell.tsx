"use client";

/**
 * Wraps children in AppShell (sidebar + content area) for all routes except
 * the auth pages (/login, /signup), which render full-screen without the
 * sidebar.
 */
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";

const AUTH_PATHS = ["/login", "/signup"];

export function ConditionalAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (isAuthPage) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
