// Testa o helper logGuardianAudit:
// - Chama supabase.from('admin_audit_log').insert() com payload correto
// - actor_type = 'guardian_web', admin_id = null
// - Não lança exceção em caso de erro do Supabase

// Mock do @supabase/supabase-js
const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

// Variáveis de ambiente mínimas para o helper não quebrar
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test';

// Importa DEPOIS de configurar o mock
import { logGuardianAudit } from '../lib/auditLog';

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ insert: mockInsert });
});

describe('logGuardianAudit — payload', () => {
  test('chama from("admin_audit_log")', async () => {
    await logGuardianAudit({ action: 'guardian_code_verified' });
    expect(mockFrom).toHaveBeenCalledWith('admin_audit_log');
  });

  test('insert contém actor_type = guardian_web', async () => {
    await logGuardianAudit({ action: 'guardian_code_verified' });
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.actor_type).toBe('guardian_web');
  });

  test('insert contém admin_id = null', async () => {
    await logGuardianAudit({ action: 'guardian_code_verified' });
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.admin_id).toBeNull();
  });

  test('insert contém entity_type = guardian', async () => {
    await logGuardianAudit({ action: 'guardian_consent_submitted' });
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.entity_type).toBe('guardian');
  });

  test('insert contém action correta', async () => {
    await logGuardianAudit({ action: 'guardian_code_verified' });
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.action).toBe('guardian_code_verified');
  });

  test('inclui entityId quando fornecido', async () => {
    await logGuardianAudit({
      action: 'guardian_code_verified',
      entityId: 'guardian-uuid-123',
    });
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.entity_id).toBe('guardian-uuid-123');
  });

  test('inclui entityLabel quando fornecido', async () => {
    await logGuardianAudit({
      action: 'guardian_code_verified',
      entityLabel: 'Carlos García',
    });
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.entity_label).toBe('Carlos García');
  });

  test('inclui details quando fornecido', async () => {
    await logGuardianAudit({
      action: 'guardian_consent_submitted',
      details: { guardian_email: 'resp@email.com', relationship_type: 'padre' },
    });
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.details.guardian_email).toBe('resp@email.com');
    expect(payload.details.relationship_type).toBe('padre');
  });

  test('admin_email é null', async () => {
    await logGuardianAudit({ action: 'guardian_code_verified' });
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.admin_email).toBeNull();
  });
});

describe('logGuardianAudit — comportamento silencioso', () => {
  test('não lança exceção quando Supabase retorna erro', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'RLS violation' } });

    await expect(
      logGuardianAudit({ action: 'guardian_code_verified' }),
    ).resolves.toBeUndefined();
  });

  test('não lança exceção quando insert rejeita a Promise', async () => {
    mockInsert.mockRejectedValue(new Error('Network error'));

    await expect(
      logGuardianAudit({ action: 'guardian_code_verified' }),
    ).resolves.toBeUndefined();
  });

  test('fluxo principal não é interrompido mesmo com falha no log', async () => {
    mockInsert.mockRejectedValue(new Error('Supabase down'));
    let mainFlowCompleted = false;

    await logGuardianAudit({ action: 'guardian_code_verified' });
    mainFlowCompleted = true;

    expect(mainFlowCompleted).toBe(true);
  });
});

describe('logGuardianAudit — ações do guardian web', () => {
  test('registra verificação de código', async () => {
    await logGuardianAudit({
      action: 'guardian_code_verified',
      entityId: 'g-uuid',
      entityLabel: 'Jugador Teste',
      details: { guardian_email: 'pai@email.com', player_id: 'p-uuid' },
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.action).toBe('guardian_code_verified');
  });

  test('registra consentimento enviado com documentos', async () => {
    await logGuardianAudit({
      action: 'guardian_consent_submitted',
      entityId: 'g-uuid',
      details: {
        relationship_type: 'madre',
        minor_doc: 'dni.pdf',
        guardian_doc: 'dni_mae.pdf',
      },
    });

    const payload = mockInsert.mock.calls[0][0];
    expect(payload.action).toBe('guardian_consent_submitted');
    expect(payload.details.minor_doc).toBe('dni.pdf');
  });
});
