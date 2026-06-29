import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';


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
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  function calculateAge(birthday: string): number {
    const birth = new Date(birthday);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
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
        throw new Error(errData.error || 'Verificación fallida');
      }

      const data = await response.json();

      // Guarda IDs para usar no consent depois
      setGuardianId(String(data.guardian_info?.id ?? ''));
      setPlayerId(String(data.guardian_info?.player_id ?? ''));
      setPlayerBirthDate(data.player_birth_date ?? null);

      setMessage(`✓ Verificado. Responsable: ${data.guardian_info?.name || 'Responsable'}`);
      setVerified(true);
      setError('');
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

    if (!response.ok) throw new Error('Upload failed');
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
      const err = await response.json();
      throw new Error(err.error || 'Error al registrar consentimiento');
    }
    return response.json();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!minorDoc || !guardianDoc || !relationship || !terms || !privacy) {
      setError('Completa todos los campos y acepta los términos');
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

      setMessage('✓ Cuenta autorizada y documentos enviados. El menor recibirá una notificación por email.');
      setVerified(false);
      setCode('');
      setEmail('');
      setGuardianId('');
      setPlayerId('');
      setPlayerBirthDate(null);
      setMinorDoc(null);
      setGuardianDoc(null);
      setRelationshipDoc(null);
      setRelationship('');
      setTerms(false);
      setPrivacy(false);
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

        {verified && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6 pt-8 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Relación con el menor
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecciona...</option>
                <option value="madre">Madre</option>
                <option value="padre">Padre</option>
                <option value="tutor_legal">Tutor/a legal</option>
                <option value="responsable_autorizado">Responsable autorizado/a</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Documento del menor (foto de DNI/cédula)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setMinorDoc(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                required
              />
              {minorDoc && (
                <p className="text-sm text-gray-500 mt-2">✓ {minorDoc.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Documento del responsable (foto de DNI/cédula)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setGuardianDoc(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                required
              />
              {guardianDoc && (
                <p className="text-sm text-gray-500 mt-2">✓ {guardianDoc.name}</p>
              )}
            </div>

            {showRelationshipDoc && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                <p className="text-sm font-semibold text-amber-800 mb-1">
                  Documento de vínculo requerido
                </p>
                <p className="text-xs text-amber-700 mb-3">
                  Según la edad del menor o tu relación con él, es necesario adjuntar un documento adicional: certidón/partida de nacimiento, documento de tutela, guarda legal o equivalente.
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Documento de vínculo
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setRelationshipDoc(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-amber-300 rounded-lg"
                  required={showRelationshipDoc}
                />
                {relationshipDoc && (
                  <p className="text-sm text-gray-500 mt-2">✓ {relationshipDoc.name}</p>
                )}
              </div>
            )}

            <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <input
                  id="terms-check"
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  className="mt-1 cursor-pointer"
                />
                <div className="text-sm text-gray-700">
                  <label htmlFor="terms-check" className="cursor-pointer">Acepto los </label>
                  <button
                    type="button"
                    onClick={() => window.open('https://futboltalent.pro/terms-and-conditions', '_blank')}
                    className="text-blue-700 underline font-medium"
                  >
                    términos y condiciones
                  </button>
                  <label htmlFor="terms-check" className="cursor-pointer"> de FutbolTalent</label>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <input
                  id="privacy-check"
                  type="checkbox"
                  checked={privacy}
                  onChange={(e) => setPrivacy(e.target.checked)}
                  className="mt-1 cursor-pointer"
                />
                <div className="text-sm text-gray-700">
                  <label htmlFor="privacy-check" className="cursor-pointer">Acepto la </label>
                  <button
                    type="button"
                    onClick={() => window.open('https://futboltalent.pro/politica-privacidad', '_blank')}
                    className="text-blue-700 underline font-medium"
                  >
                    política de privacidad
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !minorDoc || !guardianDoc || !relationship || !terms || !privacy || (showRelationshipDoc && !relationshipDoc)}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition"
            >
              {loading ? 'Enviando...' : 'Autorizar y enviar documentos'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
