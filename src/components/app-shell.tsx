import { SidebarNav } from "@/components/sidebar/sidebar-nav";
import { BreadcrumbBar } from "@/components/breadcrumb-bar";
import { PageBarSlotProvider } from "@/components/page-bar-slot";

/**
 * Top-level shell: persistent sidebar on the left, scrollable page content
 * on the right.  Lives inside the root layout's provider stack so all pages
 * automatically get the sidebar without any per-page wiring.
 *
 * Slice #20.17: BreadcrumbBar sits above the scrollable content area and
 * is always visible (it hides itself on the home page / auth pages).
 *
 * Slice 41.08: the bar is sticky in the scrolling column, so it stays on screen as the page scrolls; the column's
 * `scroll-padding-top` is the bar's height, so a tile brought into view (`?tab=`) lands under it, not behind it. The
 * provider holds the bar's slot, where a record screen portals its versions pill and „Panouri" (`page-bar-slot.tsx`).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-h-0">
      <SidebarNav />
      {/* min-h-0 prevents flex children from overflowing on short viewports.
          Slice #38.56: `data-page-scroll` names THE page's scroll area, for a screen that sizes a frame to what
          is left of the window — an ancestor with only `overflow-x-auto` computes `overflow-y: auto` too, so
          looking for the nearest scrolling ancestor finds the wrong one. */}
      <PageBarSlotProvider>
        <div className="flex flex-1 flex-col overflow-auto min-h-0 [scroll-padding-top:var(--page-bar-h,0px)]" data-page-scroll="">
          <BreadcrumbBar />
          {children}
        </div>
      </PageBarSlotProvider>
    </div>
  );
}
