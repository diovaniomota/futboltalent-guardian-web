import fs from 'fs';
import path from 'path';
import {
  TOO_MANY_ATTEMPTS_MESSAGE,
  consentErrorMessage,
  isTooManyAttempts,
  uploadErrorMessage,
  verifyErrorMessage,
} from '../lib/apiErrors';

/**
 * O limitador das Edge Functions responde 429 `{"error":"too_many_attempts"}`. O responsável precisa ler "espere uns
 * minutos", não "(HTTP 429)". Controles negativos: os outros erros mantêm a mensagem de antes, e o 429 não vaza o código.
 */
describe('429 / too_many_attempts', () => {
  test('o limitador é reconhecido pelo status ou pelo código', () => {
    expect(isTooManyAttempts(429, undefined)).toBe(true);
    expect(isTooManyAttempts(429, 'qualquer')).toBe(true);
    expect(isTooManyAttempts(200, 'too_many_attempts')).toBe(true);
    expect(isTooManyAttempts(400, 'guardian_not_found')).toBe(false); // controle negativo
    expect(isTooManyAttempts(500, undefined)).toBe(false);
  });

  test('verificação: mensagem amigável, sem "HTTP 429" nem o código técnico', () => {
    const msg = verifyErrorMessage(429, { error: 'too_many_attempts', message: 'Demasiados intentos.' });
    expect(msg).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
    expect(msg).not.toContain('429');
    expect(msg).not.toContain('too_many_attempts');
  });

  test('verificação: 429 sem corpo JSON (proxy) também vira a mensagem amigável', () => {
    expect(verifyErrorMessage(429, {})).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
  });

  test('upload: mensagem amigável, sem "(too_many_attempts)"', () => {
    const msg = uploadErrorMessage(429, { error: 'too_many_attempts' });
    expect(msg).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
    expect(msg).not.toContain('too_many_attempts');
  });

  test('consentimento: mensagem amigável, sem "(too_many_attempts)"', () => {
    const msg = consentErrorMessage(429, { error: 'too_many_attempts' });
    expect(msg).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
    expect(msg).not.toContain('too_many_attempts');
  });
});

describe('os outros erros mantêm a mensagem de antes (controle negativo)', () => {
  test('verificação', () => {
    expect(verifyErrorMessage(404, { error: 'guardian_not_found' })).toBe(
      'Código o email incorrecto. Verificá los datos e intentá nuevamente.',
    );
    expect(verifyErrorMessage(400, { error: 'guardian_code_expired' })).toContain('venció');
    expect(verifyErrorMessage(500, { error: 'algo_novo' })).toBe('Verificación fallida: algo_novo (HTTP 500)');
    expect(verifyErrorMessage(502, {})).toBe('Verificación fallida (HTTP 502). Intentá nuevamente.');
    // erro de infraestrutura do Supabase vem em `message`/`code`
    expect(verifyErrorMessage(401, { message: 'Invalid JWT' })).toBe('Verificación fallida: Invalid JWT (HTTP 401)');
  });

  test('upload', () => {
    expect(uploadErrorMessage(400, { error: 'file_too_large' })).toBe(
      'Error al subir el documento (file_too_large). Intentá nuevamente.',
    );
    expect(uploadErrorMessage(500, {})).toBe('Error al subir el documento (500). Intentá nuevamente.');
  });

  test('consentimento', () => {
    expect(consentErrorMessage(409, { error: 'guardian_already_approved' })).toBe(
      'Esta cuenta ya fue autorizada anteriormente.',
    );
    expect(consentErrorMessage(500, { error: 'algo_novo' })).toBe(
      'Error al registrar la autorización (algo_novo). Intentá nuevamente.',
    );
    expect(consentErrorMessage(500, {})).toBe('Error al registrar la autorización (desconocido). Intentá nuevamente.');
  });
});

/**
 * Teste de FONTE (prova a forma, não o comportamento): a página precisa usar os três tradutores nos três pontos em que
 * trata `!response.ok`. Se alguém voltar a montar a mensagem na mão, o 429 volta a aparecer como "(HTTP 429)".
 */
describe('pages/index.tsx usa os tradutores de erro', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index.tsx'), 'utf8');

  test.each([
    ['verifyErrorMessage'],
    ['uploadErrorMessage'],
    ['consentErrorMessage'],
  ])('chama %s', (nome) => {
    expect(page).toContain(`${nome}(`);
  });

  test('não monta mais a mensagem técnica na mão', () => {
    expect(page).not.toContain('Verificación fallida');
    expect(page).not.toContain('Error al subir el documento');
    expect(page).not.toContain('Error al registrar la autorización');
  });
});
