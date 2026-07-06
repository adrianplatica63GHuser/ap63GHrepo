import { redirect } from "next/navigation";

// Permanent redirect — the page was renamed to /admin/global-search in Slice #20.02.
// Preserves any ?search=... query params so sidebar quick-search deep-links still work.
export default function ComplexQueryRedirectPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value) params.set(key, value);
  }
  const qs = params.toString();
  redirect(`/admin/global-search${qs ? `?${qs}` : ""}`);
}
