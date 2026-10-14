const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * A trilha do Guardian Web vai para a Edge `record-guardian-audit`.
 * A chave pública não grava mais `admin_audit_log`. A Edge só aceita o
 * par código+e-mail e as duas ações deste fluxo. Falha de log não
 * interrompe o responsável.
 */
export async function logGuardianAudit(params: {
  action: string;
  code: string;
  guardianEmail: string;
  entityId?: string;
  entityLabel?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/record-guardian-audit`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: params.action,
        code: params.code,
        guardian_email: params.guardianEmail,
        entity_id: params.entityId,
        entity_label: params.entityLabel,
        details: params.details,
      }),
    });
  } catch {
    // nunca bloqueia o fluxo principal
  }
}
