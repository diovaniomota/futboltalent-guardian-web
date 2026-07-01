import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { logGuardianAudit } from '../lib/auditLog';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function AuthorizePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [guardianId, setGuardianId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerBirthDate, setPlayerBirthDate] = useState<string | null>(null);
  const [relationship, setRelationship] = useState('');
  const [minorDoc, setMinorDoc] = useState<File | null>(null);
  const [guardianDoc, setGuardianDoc] = useState<File | null>(null);
  const [relationshipDoc, setRelationshipDoc] = useState<File | null>(null);
  const [decl1, setDecl1] = useState(false);
  const [decl2, setDecl2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [success, setSuccess] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');

  function calculateAge(birthday: string): number {
    const birth = new Date(birthday);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }

  function getRelationshipLabel(rel: string): string {
    const labels: Record<string, string> = {
      madre: 'madre',
      padre: 'padre',
      tutor_legal: 'tutor/a legal',
      responsable_autorizado: 'responsable autorizado/a',
    };
    return labels[rel] || 'padre/madre/tutor';
  }

  function needsRelationshipDoc(birthDate: string | null, rel: string): boolean {
    if (!birthDate) return false;
    const age = calculateAge(birthDate);
    if (age <= 15) return true;
    if (age <= 17 && rel !== 'madre' && rel !== 'padre') return true;
    return false;
  }

  const showRelationshipDoc = needsRelationshipDoc(playerBirthDate, relationship);

  const verifyCode = useCallback(async (codeVal: string, emailVal: string) => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/verify-guardian-code`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: codeVal.trim().toUpperCase(),
            guardian_email: emailVal.trim().toLowerCase(),
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        const errorMessages: Record<string, string> = {
          guardian_already_approved: 'Esta cuenta ya fue autorizada anteriormente. El código de autorización solo puede usarse una vez.',
          guardian_not_found: 'Código o email incorrecto. Verificá los datos e intentá nuevamente.',
          guardian_code_expired: 'El código de autorización venció. El menor debe generar uno nuevo desde la app.',
          guardian_code_not_sendable: 'Este código no es válido. Contactá al club o al equipo de FutbolTalent.',
        };
        const rawError = errData.error || '';
        throw new Error(errorMessages[rawError] || 'Verificación fallida. Intentá nuevamente.');
      }

      const data = await response.json();

      // Guarda IDs para usar no consent depois
      setGuardianId(String(data.guardian_info?.id ?? ''));
      setPlayerId(String(data.guardian_info?.player_id ?? ''));
      setPlayerBirthDate(data.player_birth_date ?? null);
      setPlayerName(String(data.player_name || ''));
      setPlayerEmail(String(data.player_email || ''));

      setMessage(`✓ Verificado. Responsable: ${data.guardian_info?.name || 'Responsable'}`);
      setVerified(true);
      setError('');

      logGuardianAudit({
        action: 'guardian_code_verified',
        entityId: String(data.guardian_info?.id ?? ''),
        entityLabel: data.player_name || undefined,
        details: {
          guardian_email: emailVal.trim().toLowerCase(),
          player_id: String(data.guardian_info?.player_id ?? ''),
        },
      });
    } catch (err: any) {
      setError(err.message || 'Error al verificar');
      setMessage('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;

    const { code: urlCode, email: urlEmail } = router.query;
    const parsedCode = urlCode ? (urlCode as string).trim().toUpperCase() : '';
    const parsedEmail = urlEmail ? (urlEmail as string).trim().toLowerCase() : '';

    if (parsedCode) setCode(parsedCode);
    if (parsedEmail) setEmail(parsedEmail);

    if (parsedCode && parsedEmail) {
      verifyCode(parsedCode, parsedEmail);
    }
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyCode(code, email);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadDoc = async (base64: string, contentType: string, docType: string) => {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/upload-guardian-doc`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guardian_code: code.trim().toUpperCase(),
          guardian_email: email.trim().toLowerCase(),
          doc_type: docType,
          file_base64: base64,
          content_type: contentType,
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'unknown' }));
      throw new Error(`Error al subir el documento (${errData.error || response.status}). Intentá nuevamente.`);
    }
    return response.json();
  };

  const recordConsent = async () => {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/record-guardian-consent`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guardian_code: code.trim().toUpperCase(),
          guardian_email: email.trim().toLowerCase(),
          guardian_id: guardianId,
          player_id: playerId,
          relationship_type: relationship,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'parse_error' }));
      const consentErrors: Record<string, string> = {
        guardian_already_approved: 'Esta cuenta ya fue autorizada anteriormente.',
        guardian_not_found: 'No se encontró el registro. Verificá que el código sea correcto e intentá nuevamente.',
        consent_record_failed: 'Error al guardar la autorización en la base de datos. Intentá nuevamente.',
        db_lookup_failed: 'Error al consultar la base de datos. Intentá nuevamente en unos minutos.',
        guardian_id_and_player_id_required: 'No se pudo identificar al responsable. Recargá la página e intentá nuevamente.',
        guardian_code_and_email_required: 'El código o el correo son inválidos. Recargá la página e intentá nuevamente.',
        auth_required: 'Error de autenticación. Recargá la página e intentá nuevamente.',
        missing_supabase_env: 'Error de configuración del servidor. Contactá al soporte.',
      };
      throw new Error(consentErrors[err.error] || `Error al registrar la autorización (${err.error || 'desconocido'}). Intentá nuevamente.`);
    }
    return response.json();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!minorDoc || !guardianDoc || !relationship || !decl1 || !decl2) {
      setError('Completa todos los campos y confirmá todas las declaraciones');
      return;
    }
    if (showRelationshipDoc && !relationshipDoc) {
      setError('Debes adjuntar el documento de vínculo (certidón de nacimiento, tutela, etc.)');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const minorBase64 = await fileToBase64(minorDoc);
      await uploadDoc(minorBase64, minorDoc.type, 'minor_doc');

      const guardianBase64 = await fileToBase64(guardianDoc);
      await uploadDoc(guardianBase64, guardianDoc.type, 'guardian_doc');

      if (showRelationshipDoc && relationshipDoc) {
        const relBase64 = await fileToBase64(relationshipDoc);
        await uploadDoc(relBase64, relationshipDoc.type, 'relationship_doc');
      }

      await recordConsent();

      logGuardianAudit({
        action: 'guardian_consent_submitted',
        entityId: guardianId || undefined,
        entityLabel: playerName || undefined,
        details: {
          guardian_email: email.trim().toLowerCase(),
          player_id: playerId,
          relationship_type: relationship,
          minor_doc: minorDoc?.name,
          guardian_doc: guardianDoc?.name,
          relationship_doc: relationshipDoc?.name,
        },
      });

      setVerified(false);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt="FutbolTalent"
            width={150}
            height={80}
            priority
            className="mx-auto mb-4"
          />
          <p className="text-gray-600">Autorización de cuenta de menor</p>
        </div>

        {loading && !verified && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-3">⏳</div>
            <p>Verificando tu identidad...</p>
          </div>
        )}

        {!loading && !verified && (
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código de autorización
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej: RESP-123456"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email del responsable
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                placeholder="Ej: responsable@email.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !code || !email}
              className="w-full bg-blue-900 text-white py-2 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 transition"
            >
              {loading ? 'Verificando...' : 'Verificar código'}
            </button>
          </form>
        )}

        {message && (
          <div className="mt-6 p-4 bg-green-100 text-green-800 rounded-lg">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-100 text-red-800 rounded-lg">
            {error}
            {!verified && (
              <div className="mt-3">
                <p className="text-sm mb-2">Ingresa los datos manualmente:</p>
                <form onSubmit={handleVerify} className="space-y-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Código (Ej: RESP-123456)"
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-gray-900 text-sm"
                    required
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                    placeholder="Tu email"
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-gray-900 text-sm"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading || !code || !email}
                    className="w-full bg-blue-900 text-white py-2 rounded-lg font-semibold text-sm hover:bg-blue-800 disabled:opacity-50 transition"
                  >
                    {loading ? 'Verificando...' : 'Intentar nuevamente'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {success && (
          <div className="text-center py-8 space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">¡Cuenta autorizada!</h2>
            <p className="text-gray-600 max-w-sm mx-auto">
              El perfil del jugador está activo. La documentación enviada será revisada por el equipo de FutbolTalent.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm text-gray-500 hover:text-gray-700 underline mt-4"
            >
              Volver al inicio
            </button>
          </div>
        )}

        {!success && verified && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6 pt-8 border-t">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-0.5">
              <p className="text-sm font-bold text-blue-900">{playerName || 'el jugador'}</p>
              {playerBirthDate && (
                <p className="text-sm text-blue-700">{calculateAge(playerBirthDate)} años</p>
              )}
              {playerEmail && (
                <p className="text-sm text-blue-700">{playerEmail}</p>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900">Confirmar autorización</h2>
              <p className="text-sm text-gray-600 mt-2">Completá la documentación y confirmá cada punto para autorizar la cuenta de {playerName || 'el jugador'}.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tu relación con {playerName || 'el jugador'} *
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                required
              >
                <option value="">Seleccionar vínculo...</option>
                <option value="madre">Madre</option>
                <option value="padre">Padre</option>
                <option value="tutor_legal">Tutor/a legal</option>
                <option value="responsable_autorizado">Responsable autorizado/a</option>
              </select>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Documentos de identidad *</p>
              <p className="text-sm text-gray-500 mb-3">Para verificar esta autorización, necesitamos una fotografía o copia legible de los documentos del jugador y del adulto responsable.</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-800">
                <p className="font-semibold mb-2">Documentación requerida:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Documento completo</li>
                  <li>Buena iluminación</li>
                  <li>Sin reflejos</li>
                  <li>Formatos: JPG · PNG · PDF</li>
                  <li>Hasta 5 MB</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-gray-500">Los documentos serán utilizados únicamente para verificar esta autorización y serán tratados conforme a nuestra Política de Privacidad.</p>

              <label className="flex items-center justify-between w-full px-4 py-3 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition bg-white">
                <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                  <span className="text-gray-400 flex-shrink-0">📄</span>
                  <span className="truncate">{minorDoc ? minorDoc.name : 'DNI / documento del jugador'}</span>
                </div>
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setMinorDoc(e.target.files?.[0] || null)} className="hidden" />
              </label>

              <label className="flex items-center justify-between w-full px-4 py-3 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition bg-white">
                <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                  <span className="text-gray-400 flex-shrink-0">📄</span>
                  <span className="truncate">{guardianDoc ? guardianDoc.name : 'DNI / documento del responsable'}</span>
                </div>
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setGuardianDoc(e.target.files?.[0] || null)} className="hidden" />
              </label>
            </div>

            {showRelationshipDoc && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                <p className="text-sm font-semibold text-amber-800 mb-1">Documento de vínculo requerido</p>
                <p className="text-xs text-amber-700 mb-3">
                  Según la edad del menor o tu relación con él, es necesario adjuntar un documento adicional: certidón/partida de nacimiento, documento de tutela, guarda legal o equivalente.
                </p>
                <label className="flex items-center justify-between w-full px-4 py-3 border border-amber-300 rounded-lg cursor-pointer hover:border-amber-500 transition bg-white">
                  <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                    <span className="text-gray-400 flex-shrink-0">📄</span>
                    <span className="truncate">{relationshipDoc ? relationshipDoc.name : 'Documento de vínculo'}</span>
                  </div>
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => setRelationshipDoc(e.target.files?.[0] || null)} className="hidden" />
                </label>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Declaraciones *
              </div>

              <div className="flex items-start gap-3">
                <input id="decl1" type="checkbox" checked={decl1} onChange={(e) => setDecl1(e.target.checked)} className="mt-0.5 cursor-pointer accent-blue-700 w-4 h-4 flex-shrink-0" />
                <label htmlFor="decl1" className="text-sm text-gray-700 cursor-pointer leading-snug">
                  Confirmo ser el adulto responsable de {playerName || 'el jugador'}, y que la documentación proporcionada es verídica y auténtica.
                </label>
              </div>
              <div className="flex items-start gap-3">
                <input id="decl2" type="checkbox" checked={decl2} onChange={(e) => setDecl2(e.target.checked)} className="mt-0.5 cursor-pointer accent-blue-700 w-4 h-4 flex-shrink-0" />
                <label htmlFor="decl2" className="text-sm text-gray-700 cursor-pointer leading-snug">
                  Confirmo haber leído y aceptado los{' '}
                  <a href="https://futboltalent.pro/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="text-blue-900 underline font-semibold">Términos y Condiciones</a>
                  {' '}y la{' '}
                  <a href="https://futboltalent.pro/politica-privacidad" target="_blank" rel="noopener noreferrer" className="text-blue-900 underline font-semibold">Política de Privacidad</a>
                  {' '}de FutbolTalent.pro.
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !minorDoc || !guardianDoc || !relationship || !decl1 || !decl2 || (showRelationshipDoc && !relationshipDoc)}
              className="w-full bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 transition"
            >
              {loading ? 'Enviando...' : 'Autorizar cuenta'}
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2 transition"
            >
              Volver al inicio
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

