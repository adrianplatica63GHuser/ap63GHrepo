"use client";

import { useState } from "react";
import { PropertyForm } from "./property-form";

type Props = {
  title: string;
};

/**
 * Client wrapper for the "New Property" page.
 * Holds the Big Map toggle's state, which the form reports through
 * onBigMapChange; since Slice #37.14 the container no longer changes width.
 */
export function NewPropertyShell({ title }: Props) {
  const [bigMap, setBigMap] = useState(false);

  return (
    // Slice #37.14: never centred or capped — the panels have fixed widths and
    // sit left-aligned (#37.12). `bigMap` still drives the theater overlay.
    <div className="w-full flex flex-col gap-6" data-big-map={bigMap ? "on" : "off"}>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </header>
      <PropertyForm mode="create" onBigMapChange={setBigMap} />
    </div>
  );
}
