import fs from 'fs';
import path from 'path';
import { nomeDoResponsavelConhecido, normalizarNomeResponsavel } from '../lib/guardianName';

/**
 * O nome do responsável é o que a conferência automática (OCR) procura no documento dele. Até 11/11/2026 o formulário não o
 * pedia e o banco tinha o texto fixo "Responsable legal" para todos: nenhum caso poderia ser aprovado automaticamente.
 * A regra é a MESMA da Edge Function `record-guardian-consent` (`_shared/guardian_nome.ts`), que é quem decide.
 */
describe('normalizarNomeResponsavel', () => {
  test('nome e sobrenome com acento, apóstrofo e hífen servem, e saem limpos', () => {
    expect(normalizarNomeResponsavel('  María   José  Gómez-Sosa ')).toBe('María José Gómez-Sosa');
    expect(normalizarNomeResponsavel("Ana D'Ávila")).toBe("Ana D'Ávila");
    expect(normalizarNomeResponsavel('João P. Conceição')).toBe('João P. Conceição');
  });

  test('um nome só, número, símbolo e tamanho fora da faixa não servem', () => {
    for (const ruim of ['Maria', 'Maria 123', 'Maria <b>Gomez</b>', 'Maria Gomez;', 'Al B', 'a '.repeat(70), '', '   ', '- -']) {
      expect(normalizarNomeResponsavel(ruim)).toBeNull();
    }
    expect(normalizarNomeResponsavel(undefined)).toBeNull();
  });

  test('os textos fixos que o app gravava não são nome de ninguém', () => {
    for (const fixo of ['Responsable legal', 'RESPONSÁVEL LEGAL', 'Legal guardian']) {
      expect(normalizarNomeResponsavel(fixo)).toBeNull();
      expect(nomeDoResponsavelConhecido(fixo)).toBeNull();
    }
    expect(nomeDoResponsavelConhecido('Maria Gomez')).toBe('Maria Gomez');
    expect(nomeDoResponsavelConhecido(null)).toBeNull();
  });
});

/**
 * Teste de FONTE (prova a forma, não o comportamento): a página manda o nome à Edge e não mostra o formulário do código
 * em cima da tela de sucesso. O comportamento do servidor está provado nos testes da Edge.
 */
describe('pages/index.tsx', () => {
  const fonte = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index.tsx'), 'utf8');

  test('o consentimento leva o nome normalizado', () => {
    expect(fonte).toMatch(/guardian_name:\s*normalizarNomeResponsavel\(guardianName\)/);
  });

  test('o envio é recusado antes da rede sem um nome válido', () => {
    const antes = fonte.indexOf('if (!normalizarNomeResponsavel(guardianName))');
    const upload = fonte.indexOf("await uploadDoc(minorBase64");
    expect(antes).toBeGreaterThan(0);
    expect(antes).toBeLessThan(upload);
  });

  test('o formulário do código não reaparece depois do sucesso', () => {
    expect(fonte).toContain('{!loading && !verified && !success && (');
  });

  test('o texto fixo "Responsable legal" não é mostrado como o nome declarado', () => {
    expect(fonte).not.toContain("data.guardian_info?.name || 'Responsable'");
  });
});
