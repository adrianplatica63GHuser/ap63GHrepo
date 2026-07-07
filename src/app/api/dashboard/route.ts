/**
 * GET /api/dashboard
 *
 * Returns all four operational dashboard data sets in a single response.
 * All queries run in parallel.  No authentication gate — the middleware
 * already protects all routes; reaching this handler means the user is
 * signed in.
 */

import { unexpectedError } from "@/lib/api/errors";
import {
  getDashboardExpiringDocuments,
  getDashboardRecentActivity,
  getDashboardRecentCounts,
  getDashboardStaleMetadata,
} from "@/lib/dashboard/queries";
import { getTimeFrameSettings } from "@/lib/time-frames/queries";
import { getDays } from "@/lib/time-frames/config";

export async function GET(): Promise<Response> {
  try {
    const tf = await getTimeFrameSettings();

    const [recentCounts, expiringDocuments, staleMetadata, recentActivity] =
      await Promise.all([
        getDashboardRecentCounts(getDays(tf, "dashboard_recent_days")),
        getDashboardExpiringDocuments(getDays(tf, "dashboard_expiring_docs")),
        getDashboardStaleMetadata(getDays(tf, "dashboard_stale_metadata")),
        getDashboardRecentActivity(),
      ]);

    return Response.json({
      recentCounts,
      expiringDocuments,
      staleMetadata,
      recentActivity,
    });
  } catch (err) {
    return unexpectedError(err);
  }
}
