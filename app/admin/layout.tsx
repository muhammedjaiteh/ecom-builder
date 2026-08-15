import { Shield } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// CEO Vault shell — purely presentational, on purpose.
//
// Access control does NOT live here anymore:
//   Wall 1 (UX)            proxy.ts fail-closes every /admin path server-side
//                          (redirect to /dashboard unless role-or-pinned-email)
//                          BEFORE this layout ever renders.
//   Wall 2 (AUTHORITATIVE) every /api/admin/* route re-verifies role AND
//                          pinned email before touching the service role.
//
// The old client-side gate here compared against a hardcoded email and
// console.logged it to EVERY visitor — leaking the admin identity and
// conflicting with the env-driven pinned email. Both flaws are gone.
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9F8F6]">
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-gray-900">CEO Vault</h1>
              <p className="text-xs text-gray-500">Approval queue &amp; shop control</p>
            </div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
