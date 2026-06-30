// Testa funções puras extraídas do formulário de autorização de menores

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

function getRelationshipLabel(rel: string): string {
  const labels: Record<string, string> = {
    madre: 'madre',
    padre: 'padre',
    tutor_legal: 'tutor/a legal',
    responsable_autorizado: 'responsable autorizado/a',
  };
  return labels[rel] || 'padre/madre/tutor';
}

const currentYear = new Date().getFullYear();

// Gera uma data local (sem UTC parse) para evitar problemas de fuso horário
function localDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

describe('calculateAge', () => {
  test('retorna idade correta para nascido há exatamente 16 anos', () => {
    const now = new Date();
    // Aniversário foi ontem: garante que já completou 16 anos
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const birthday = localDateStr(
      yesterday.getFullYear() - 16,
      yesterday.getMonth() + 1,
      yesterday.getDate(),
    );
    expect(calculateAge(birthday)).toBe(16);
  });

  test('retorna 0 para nascido hoje', () => {
    const now = new Date();
    const birthday = localDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
    expect(calculateAge(birthday)).toBe(0);
  });

  test('decrementa quando aniversário ainda não ocorreu este ano', () => {
    // Usa setembro (mês 9) — sempre futuro em relação a junho e
    // seguro contra problemas de fuso UTC vs local
    const year = currentYear - 15;
    const birthday = localDateStr(year, 9, 15); // 15 de setembro
    const now = new Date();
    const expected = now.getMonth() < 8 ? 14 : 15; // antes de set = 14, após = 15
    expect(calculateAge(birthday)).toBe(expected);
  });

  test('identifica menor de 18 anos corretamente', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const birthday = localDateStr(
      yesterday.getFullYear() - 17,
      yesterday.getMonth() + 1,
      yesterday.getDate(),
    );
    expect(calculateAge(birthday)).toBeLessThan(18);
  });

  test('identifica maior de 18 anos corretamente', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const birthday = localDateStr(
      yesterday.getFullYear() - 20,
      yesterday.getMonth() + 1,
      yesterday.getDate(),
    );
    expect(calculateAge(birthday)).toBeGreaterThanOrEqual(18);
  });
});

describe('needsRelationshipDoc', () => {
  test('retorna false quando birthDate é null', () => {
    expect(needsRelationshipDoc(null, 'padre')).toBe(false);
  });

  test('retorna true para menor de 14 anos independente do vínculo', () => {
    // Usa data que garante 14 anos completos (ontem foi aniversário)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const birthday = localDateStr(
      yesterday.getFullYear() - 14,
      yesterday.getMonth() + 1,
      yesterday.getDate(),
    );
    expect(needsRelationshipDoc(birthday, 'padre')).toBe(true);
    expect(needsRelationshipDoc(birthday, 'madre')).toBe(true);
    expect(needsRelationshipDoc(birthday, 'tutor_legal')).toBe(true);
  });

  test('retorna true para 16 anos completos com tutor_legal', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const birthday = localDateStr(
      yesterday.getFullYear() - 16,
      yesterday.getMonth() + 1,
      yesterday.getDate(),
    );
    expect(needsRelationshipDoc(birthday, 'tutor_legal')).toBe(true);
  });

  test('retorna true para 17 anos com responsable_autorizado', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const birthday = localDateStr(
      yesterday.getFullYear() - 17,
      yesterday.getMonth() + 1,
      yesterday.getDate(),
    );
    expect(needsRelationshipDoc(birthday, 'responsable_autorizado')).toBe(true);
  });

  test('retorna false para 16 e 17 anos com madre ou padre', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const b16 = localDateStr(yesterday.getFullYear() - 16, yesterday.getMonth() + 1, yesterday.getDate());
    const b17 = localDateStr(yesterday.getFullYear() - 17, yesterday.getMonth() + 1, yesterday.getDate());
    expect(needsRelationshipDoc(b16, 'madre')).toBe(false);
    expect(needsRelationshipDoc(b16, 'padre')).toBe(false);
    expect(needsRelationshipDoc(b17, 'madre')).toBe(false);
    expect(needsRelationshipDoc(b17, 'padre')).toBe(false);
  });

  test('retorna false para maior de 18 anos', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const birthday = localDateStr(
      yesterday.getFullYear() - 19,
      yesterday.getMonth() + 1,
      yesterday.getDate(),
    );
    expect(needsRelationshipDoc(birthday, 'tutor_legal')).toBe(false);
  });
});

describe('getRelationshipLabel', () => {
  test('retorna label correto para madre', () => {
    expect(getRelationshipLabel('madre')).toBe('madre');
  });

  test('retorna label correto para padre', () => {
    expect(getRelationshipLabel('padre')).toBe('padre');
  });

  test('retorna label correto para tutor_legal', () => {
    expect(getRelationshipLabel('tutor_legal')).toBe('tutor/a legal');
  });

  test('retorna label correto para responsable_autorizado', () => {
    expect(getRelationshipLabel('responsable_autorizado')).toBe('responsable autorizado/a');
  });

  test('retorna fallback para vínculo desconhecido', () => {
    expect(getRelationshipLabel('outro')).toBe('padre/madre/tutor');
  });
});
