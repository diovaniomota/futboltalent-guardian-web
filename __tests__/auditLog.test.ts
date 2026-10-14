const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
global.fetch = mockFetch as unknown as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test';

import { logGuardianAudit } from '../lib/auditLog';

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
});

function sentBody(): Record<string, unknown> {
  const init = mockFetch.mock.calls[0][1] as RequestInit;
  return JSON.parse(String(init.body));
}

describe('logGuardianAudit — Edge', () => {
  test('chama record-guardian-audit e não a tabela', async () => {
    await logGuardianAudit({
      action: 'guardian_code_verified',
      code: 'ABC',
      guardianEmail: 'resp@email.com',
    });
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain('/functions/v1/record-guardian-audit');
    expect(url).not.toContain('admin_audit_log');
  });

  test('manda action, código e e-mail', async () => {
    await logGuardianAudit({
      action: 'guardian_consent_submitted',
      code: 'XYZ',
      guardianEmail: 'resp@email.com',
      entityId: 'g-uuid',
      entityLabel: 'Jugador',
      details: { relationship_type: 'padre' },
    });
    const body = sentBody();
    expect(body.action).toBe('guardian_consent_submitted');
    expect(body.code).toBe('XYZ');
    expect(body.guardian_email).toBe('resp@email.com');
    expect(body.entity_id).toBe('g-uuid');
    expect(body.entity_label).toBe('Jugador');
    expect((body.details as { relationship_type: string }).relationship_type).toBe('padre');
  });

  test('não lança quando a rede falha', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    await expect(
      logGuardianAudit({
        action: 'guardian_code_verified',
        code: 'ABC',
        guardianEmail: 'resp@email.com',
      }),
    ).resolves.toBeUndefined();
  });
});
