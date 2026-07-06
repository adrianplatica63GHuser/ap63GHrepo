import { DashboardClient } from "./_components/dashboard-client";

/**
 * Operational dashboard — "ce necesită atenția mea azi?"
 *
 * Slice #22.01: replaced the old static landing pad with a live dashboard
 * showing recent activity, expiring documents, and stale metadata.
 */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <DashboardClient />
    </div>
  );
}
