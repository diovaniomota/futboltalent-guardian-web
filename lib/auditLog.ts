import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function logGuardianAudit(params: {
  action: string;
  entityId?: string;
  entityLabel?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await supabase.from('admin_audit_log').insert({
      actor_type: 'guardian_web',
      admin_id: null,
      admin_email: null,
      action: params.action,
      entity_type: 'guardian',
      entity_id: params.entityId,
      entity_label: params.entityLabel,
      details: params.details,
    });
  } catch {
    // nunca bloqueia o fluxo principal
  }
}
