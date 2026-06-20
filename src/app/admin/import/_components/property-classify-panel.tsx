"use client";

/**
 * PropertyClassifyPanel — Classify dialog, Property branch.
 *
 * Reuses the existing /api/properties/parse-text + POST /api/properties
 * endpoints (same ones AddPropertyDialog's text-file flow already uses).
 * The filename (minus extension) becomes the new property's nickname.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

type Corner = { lat: number; lon: number };

type Props = {
  file: File;
  onBack: () => void;
  onClassified: () => void;
  onClose: () => void;
};

function nicknameFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

async function callParseTextApi(file: File): Promise<Corner[]> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/properties/parse-text", { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { corners: Corner[] };
  return data.corners ?? [];
}

async function callCreateProperty(corners: Corner[], nickname: string): Promise<string> {
  const res = await fetch("/api/properties", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ corners, nickname }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { property?: { id?: string } };
  if (!data.property?.id) throw new Error("No id returned from API");
  return data.property.id;
}

export function PropertyClassifyPanel({ file, onBack, onClassified, onClose }: Props) {
  const t = useTranslations("adminImport.classify");
  const tp = useTranslations("adminImport.classify.property");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState(() => nicknameFromFilename(file.name));

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const corners = await callParseTextApi(file);
      if (corners.length === 0) {
        setError(tp("noCoordinatesFound"));
        setImporting(false);
        return;
      }
      const id = await callCreateProperty(corners, nickname.trim() || nicknameFromFilename(file.name));
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      onClassified();
      onClose();
      router.push(`/properties/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tp("error"));
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <span className="w-28 shrink-0 font-medium text-ink dark:text-zinc-300">
          {tp("nicknameLabel")}
        </span>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          disabled={importing}
          className="w-full min-w-0 flex-1 rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none disabled:bg-canvas dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={importing}
          className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {t("back")}
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={importing}
          className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing ? tp("importing") : tp("importButton")}
        </button>
      </div>
    </div>
  );
}
