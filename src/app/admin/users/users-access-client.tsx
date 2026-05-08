"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { CheckCircle, XCircle, Clock, UserCheck, UserX } from "lucide-react";

type RequestStatus = "pending" | "approved" | "rejected";

interface UserRequest {
  id: string;
  email: string;
  username: string;
  status: RequestStatus;
  requestedAt: string;
  processedAt: string | null;
  processedBy: string | null;
  emailSent: boolean;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchRequests(status?: RequestStatus): Promise<UserRequest[]> {
  const url = status
    ? `/api/admin/user-requests?status=${status}`
    : "/api/admin/user-requests";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load requests");
  const { requests } = await res.json();
  return requests;
}

async function approveRequest(requestId: string) {
  const res = await fetch("/api/admin/user-requests/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error ?? "Approval failed");
  }
  return res.json();
}

async function rejectRequest(requestId: string) {
  const res = await fetch("/api/admin/user-requests/reject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error ?? "Rejection failed");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type TFunc = ReturnType<typeof useTranslations<"usersAccess">>;

function StatusBadge({ status, t }: { status: RequestStatus; t: TFunc }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-medium">
        <Clock size={11} />
        {t("status.pending")}
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium">
        <CheckCircle size={11} />
        {t("status.approved")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-medium">
      <XCircle size={11} />
      {t("status.rejected")}
    </span>
  );
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Tab = "pending" | "history";

export function UsersAccessClient() {
  const t      = useTranslations("usersAccess");
  const locale = useLocale();

  const [tab, setTab]                     = useState<Tab>("pending");
  const [actionError, setActionError]     = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const queryClient                       = useQueryClient();

  const pendingQuery = useQuery({
    queryKey: ["user-requests", "pending"],
    queryFn: () => fetchRequests("pending"),
  });

  const historyQuery = useQuery({
    queryKey: ["user-requests", "history"],
    queryFn: () => fetchRequests(),
    select: (data) => data.filter((r) => r.status !== "pending"),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["user-requests"] });
  }, [queryClient]);

  const approveMutation = useMutation({
    mutationFn: approveRequest,
    onSuccess: (data) => {
      invalidate();
      setActionSuccess(
        data.emailSent
          ? t("feedback.approvedWithEmail")
          : t("feedback.approvedNoEmail"),
      );
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message);
      setActionSuccess(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectRequest,
    onSuccess: (data) => {
      invalidate();
      setActionSuccess(
        data.emailSent
          ? t("feedback.rejectedWithEmail")
          : t("feedback.rejectedNoEmail"),
      );
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message);
      setActionSuccess(null);
    },
  });

  const isBusy = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div>
      {actionSuccess && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 text-green-800 px-4 py-2 text-sm flex items-center gap-2">
          <CheckCircle size={14} className="shrink-0" />
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 px-4 py-2 text-sm flex items-center gap-2">
          <XCircle size={14} className="shrink-0" />
          {actionError}
        </div>
      )}

      <div className="flex gap-1 border-b border-wire mb-4">
        {(["pending", "history"] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={[
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              tab === tabKey
                ? "border-cta text-cta"
                : "border-transparent text-fade hover:text-ink",
            ].join(" ")}
          >
            {tabKey === "pending" ? t("tabs.pending") : t("tabs.history")}
            {tabKey === "pending" &&
              pendingQuery.data &&
              pendingQuery.data.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-xs font-semibold">
                  {pendingQuery.data.length}
                </span>
              )}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <RequestTable
          query={pendingQuery}
          showActions
          onApprove={(id) => {
            setActionError(null);
            setActionSuccess(null);
            approveMutation.mutate(id);
          }}
          onReject={(id) => {
            setActionError(null);
            setActionSuccess(null);
            rejectMutation.mutate(id);
          }}
          isBusy={isBusy}
          t={t}
          locale={locale}
        />
      )}

      {tab === "history" && (
        <RequestTable
          query={historyQuery}
          showActions={false}
          onApprove={() => {}}
          onReject={() => {}}
          isBusy={false}
          t={t}
          locale={locale}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function RequestTable({
  query,
  showActions,
  onApprove,
  onReject,
  isBusy,
  t,
  locale,
}: {
  query: ReturnType<typeof useQuery<UserRequest[]>>;
  showActions: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isBusy: boolean;
  t: TFunc;
  locale: string;
}) {
  if (query.isPending) {
    return <p className="text-sm text-fade py-8 text-center">{t("table.loading")}</p>;
  }
  if (query.isError) {
    return <p className="text-sm text-red-600 py-8 text-center">{t("table.error")}</p>;
  }

  const rows = query.data ?? [];

  if (rows.length === 0) {
    return (
      <p className="text-sm text-fade py-8 text-center">
        {showActions ? t("table.emptyPending") : t("table.emptyHistory")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-wire">
      <table className="w-full text-sm">
        <thead className="bg-surface border-b border-wire">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-fade">{t("table.username")}</th>
            <th className="text-left px-4 py-2 font-medium text-fade">{t("table.email")}</th>
            <th className="text-left px-4 py-2 font-medium text-fade">{t("table.submitted")}</th>
            {!showActions && (
              <>
                <th className="text-left px-4 py-2 font-medium text-fade">{t("table.status")}</th>
                <th className="text-left px-4 py-2 font-medium text-fade">{t("table.processed")}</th>
                <th className="text-left px-4 py-2 font-medium text-fade">{t("table.by")}</th>
              </>
            )}
            {showActions && (
              <th className="text-left px-4 py-2 font-medium text-fade">{t("table.actions")}</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-wire">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface transition-colors">
              <td className="px-4 py-2.5 font-medium text-ink">{row.username}</td>
              <td className="px-4 py-2.5 text-fade">{row.email}</td>
              <td className="px-4 py-2.5 text-fade whitespace-nowrap">
                {formatDate(row.requestedAt, locale)}
              </td>
              {!showActions && (
                <>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={row.status} t={t} />
                  </td>
                  <td className="px-4 py-2.5 text-fade whitespace-nowrap">
                    {row.processedAt ? formatDate(row.processedAt, locale) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-fade">{row.processedBy ?? "—"}</td>
                </>
              )}
              {showActions && (
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onApprove(row.id)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs font-medium disabled:opacity-50 transition"
                    >
                      <UserCheck size={12} />
                      {t("actions.approve")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(row.id)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs font-medium disabled:opacity-50 transition"
                    >
                      <UserX size={12} />
                      {t("actions.reject")}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
