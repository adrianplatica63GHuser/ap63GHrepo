"use client";

import { useState } from "react";
import { PropertyForm } from "./property-form";

type Props = {
  title: string;
};

/**
 * Client wrapper for the "New Property" page.
 * Manages bigMap state so the container can expand beyond max-w-4xl when
 * the Show Big Map toggle is active.
 */
export function NewPropertyShell({ title }: Props) {
  const [bigMap, setBigMap] = useState(false);

  return (
    <div className={bigMap ? "w-full flex flex-col gap-6" : "max-w-4xl mx-auto w-full flex flex-col gap-6"}>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </header>
      <PropertyForm mode="create" onBigMapChange={setBigMap} />
    </div>
  );
}
