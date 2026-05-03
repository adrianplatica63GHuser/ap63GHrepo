import { SidebarNav } from "@/components/sidebar/sidebar-nav";

/**
 * Top-level shell: persistent sidebar on the left, scrollable page content
 * on the right.  Lives inside the root layout's provider stack so all pages
 * automatically get the sidebar without any per-page wiring.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-h-0">
      <SidebarNav />
      {/* min-h-0 prevents flex children from overflowing on short viewports */}
      <div className="flex flex-1 flex-col overflow-auto min-h-0">
        {children}
      </div>
    </div>
  );
}
