"use client";

/**
 * ErrorBoundary — class component (React error boundaries MUST be class
 * components; hooks cannot catch render-time exceptions).
 *
 * Usage:
 *   <ErrorBoundary fallback={<PanelError>{t("errorBoundary.map")}</PanelError>}>
 *     <SomeComplexPanel />
 *   </ErrorBoundary>
 *
 * If `fallback` is omitted a generic default Romanian message is shown.
 *
 * Also exports `PanelError` — a styled container for fallback content that
 * fills its parent and renders consistently across all error boundary call sites.
 */

import { Component, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// PanelError — styled fallback container
// ---------------------------------------------------------------------------

interface PanelErrorProps {
  children: ReactNode;
}

export function PanelError({ children }: PanelErrorProps) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------

interface Props {
  children: ReactNode;
  /** Custom fallback UI. If omitted, a generic Romanian message is shown. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static override getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console so developers can spot crashes during development.
    console.error("[ErrorBoundary] Caught render error:", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <PanelError>A apărut o eroare neașteptată.</PanelError>
        )
      );
    }
    return this.props.children;
  }
}
