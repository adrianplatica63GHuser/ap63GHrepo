import { SidebarNav } from "@/components/sidebar/sidebar-nav";
import { BreadcrumbBar } from "@/components/breadcrumb-bar";

/**
 * Top-level shell: persistent sidebar on the left, scrollable page content
 * on the right.  Lives inside the root layout's provider stack so all pages
 * automatically get the sidebar without any per-page wiring.
 *
 * Slice #20.17: BreadcrumbBar sits above the scrollable content area and
 * is always visible (it hides itself on the home page / auth pages).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-h-0">
      <SidebarNav />
      {/* min-h-0 prevents flex children from overflowing on short viewports.
          Slice #38.56: `data-page-scroll` names THE page's scroll area, for a screen that sizes a frame to what
          is left of the window — an ancestor with only `overflow-x-auto` computes `overflow-y: auto` too, so
          looking for the nearest scrolling ancestor finds the wrong one. */}
      <div className="flex flex-1 flex-col overflow-auto min-h-0" data-page-scroll="">
        <BreadcrumbBar />
        {children}
      </div>
    </div>
  );
}
