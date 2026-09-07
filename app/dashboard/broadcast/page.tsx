// ─────────────────────────────────────────────────────────────────────────────
// Broadcast — promoted from the retired /dashboard?tab=broadcast pane to its
// own route. The WhatsApp Broadcast Engine (app/dashboard/broadcast.tsx — a
// colocated client component, not a route file) owns its own auth, tier gate
// and data; this route only gives it the standard shell.
// ─────────────────────────────────────────────────────────────────────────────

import { DashboardShell } from '@/components/dashboard/DashboardShell';
import Broadcast from '../broadcast';

export default function BroadcastRoute() {
  return (
    <DashboardShell title="Broadcast" backLink={{ href: '/dashboard', label: 'Home' }}>
      {/* Extra safe-area bottom clearance below lg: the floating sidebar
          trigger (DashboardSidebar, fixed left-4 z-50 at bottom
          max(1.25rem, safe-area)) must never cover the pane's full-width
          left-edge Send buttons / footer at end of scroll. */}
      <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <Broadcast />
      </div>
    </DashboardShell>
  );
}
