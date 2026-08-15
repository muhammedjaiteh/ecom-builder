// ─────────────────────────────────────────────────────────────────────────────
// CEO Vault audit trail — every admin tier/status mutation lands one row in
// public.admin_actions (sql/provisioning.sql §5: RLS enabled with ZERO
// policies, so only the service-role client can write — by construction).
//
// THE MONEY RULE: audit-log failure must NEVER fail the approval. A seller
// who paid gets activated even if the audit insert dies; the failure is
// console.error'd for the server logs instead.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminAuditAction = 'approve_payment' | 'suspend' | 'update_shop';

const PAID_TIERS = ['starter', 'pro', 'advanced', 'flagship'];

/** Server-side action classification — the client never dictates audit
 *  semantics. Suspension (by status or tier) wins; a locked shop (pending /
 *  suspended / missing tier) moving to a paid tier is a payment approval;
 *  everything else is a god-mode shop update. */
export function classifyAdminAction(opts: {
  fromTier: string | null;
  toTier: string | null;
  toStatus?: string | null;
}): AdminAuditAction {
  const from = (opts.fromTier ?? '').toLowerCase().trim();
  const to = (opts.toTier ?? '').toLowerCase().trim();
  const status = (opts.toStatus ?? '').toLowerCase().trim();
  if (status === 'suspended' || to === 'suspended') return 'suspend';
  if (PAID_TIERS.includes(to) && (from === 'pending' || from === 'suspended' || from === '')) {
    return 'approve_payment';
  }
  return 'update_shop';
}

/** Best-effort audit insert via the service-role client. Swallows every
 *  failure into console.error — see THE MONEY RULE above. */
export async function recordAdminAction(
  supabaseAdmin: SupabaseClient,
  row: {
    admin_id: string;
    target_shop_id: string;
    action: AdminAuditAction;
    from_tier: string | null;
    to_tier: string | null;
    notes: string | null;
  }
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('admin_actions').insert(row);
    if (error) {
      console.error('[admin-audit] insert failed (approval unaffected):', error.message, row);
    }
  } catch (err) {
    console.error('[admin-audit] insert crashed (approval unaffected):', err, row);
  }
}
