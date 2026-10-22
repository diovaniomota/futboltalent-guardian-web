/**
 * Mensagens de erro das três Edge Functions do fluxo (verify-guardian-code, upload-guardian-doc,
 * record-guardian-consent).
 *
 * `too_many_attempts` (HTTP 429) é o limitador de tentativas por IP das Edge Functions. Antes o responsável via
 * "Verificación fallida: too_many_attempts (HTTP 429)" — texto técnico, sem dizer o que fazer. Um responsável legítimo
 * pode chegar ao limite (um envio completo faz até 3 uploads) e precisa saber que é só esperar.
 *
 * Não lemos o cabeçalho `Retry-After`: ele não é "CORS-safelisted" e as Edge Functions não o expõem
 * (`Access-Control-Expose-Headers`), então o navegador não o entrega ao `fetch`. A mensagem diz "unos minutos",
 * como a própria Edge.
 */
export const TOO_MANY_ATTEMPTS_MESSAGE =
  'Hiciste demasiados intentos en poco tiempo. Por seguridad, esperá unos minutos antes de volver a intentar.';

/** 429 do limitador, ou o código que a Edge devolve no corpo (também chega assim se um proxy trocar o status). */
export function isTooManyAttempts(status: number, code?: unknown): boolean {
  return status === 429 || code === 'too_many_attempts';
}

type ErrorBody = Record<string, unknown>;

const VERIFY_ERRORS: Record<string, string> = {
  guardian_already_approved: 'Esta cuenta ya fue autorizada anteriormente. El código de autorización solo puede usarse una vez.',
  guardian_not_found: 'Código o email incorrecto. Verificá los datos e intentá nuevamente.',
  guardian_code_expired: 'El código de autorización venció. El menor debe generar uno nuevo desde la app.',
  guardian_code_not_sendable: 'Este código no es válido. Contactá al club o al equipo de FutbolTalent.',
  db_query_failed: 'Error al consultar la base de datos. Intentá nuevamente en unos minutos.',
  invalid_payload: 'El código o el correo son inválidos. Recargá la página e intentá nuevamente.',
  missing_supabase_env: 'Error de configuración del servidor. Contactá al soporte.',
  internal_error: 'Error interno del servidor. Intentá nuevamente en unos minutos.',
};

const CONSENT_ERRORS: Record<string, string> = {
  guardian_already_approved: 'Esta cuenta ya fue autorizada anteriormente.',
  guardian_not_found: 'No se encontró el registro. Verificá que el código sea correcto e intentá nuevamente.',
  consent_record_failed: 'Error al guardar la autorización en la base de datos. Intentá nuevamente.',
  db_lookup_failed: 'Error al consultar la base de datos. Intentá nuevamente en unos minutos.',
  guardian_id_and_player_id_required: 'No se pudo identificar al responsable. Recargá la página e intentá nuevamente.',
  guardian_code_and_email_required: 'El código o el correo son inválidos. Recargá la página e intentá nuevamente.',
  auth_required: 'Error de autenticación. Recargá la página e intentá nuevamente.',
  missing_supabase_env: 'Error de configuración del servidor. Contactá al soporte.',
};

/** Verificación del código. `errData.error` é o nosso campo; `message`/`code` são erro de infraestrutura do Supabase. */
export function verifyErrorMessage(status: number, errData: ErrorBody): string {
  const rawError = String(errData.error || errData.message || errData.code || '');
  if (isTooManyAttempts(status, errData.error)) return TOO_MANY_ATTEMPTS_MESSAGE;
  const statusHint = `HTTP ${status}`;
  return (
    VERIFY_ERRORS[rawError] ||
    (rawError
      ? `Verificación fallida: ${rawError} (${statusHint})`
      : `Verificación fallida (${statusHint}). Intentá nuevamente.`)
  );
}

/** Envio de um documento. */
export function uploadErrorMessage(status: number, errData: ErrorBody): string {
  if (isTooManyAttempts(status, errData.error)) return TOO_MANY_ATTEMPTS_MESSAGE;
  return `Error al subir el documento (${errData.error || status}). Intentá nuevamente.`;
}

/** Registro do consentimento. */
export function consentErrorMessage(status: number, errData: ErrorBody): string {
  if (isTooManyAttempts(status, errData.error)) return TOO_MANY_ATTEMPTS_MESSAGE;
  const code = String(errData.error ?? '');
  return (
    CONSENT_ERRORS[code] ||
    `Error al registrar la autorización (${errData.error || 'desconocido'}). Intentá nuevamente.`
  );
}
