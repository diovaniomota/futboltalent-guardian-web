// O NOME DO RESPONSÁVEL — de onde a conferência automática tira o nome que procura no documento dele.
//
// Até 11/11/2026 ninguém perguntava o nome: o app gravava o texto fixo "Responsable legal" em `guardians.name`
// (empieza_comecar_widget.dart) e o formulário do Guardian Web não tinha o campo. Os 41 responsáveis do banco estavam
// assim, e o OCR procurava "Responsable legal" no documento da mãe: nenhum caso poderia ser aprovado. Agora o responsável
// digita o nome no Guardian Web e `record-guardian-consent` o grava.
//
// Duas funções puras, sem I/O:
//   - `normalizarNomeResponsavel`: o que o responsável DIGITOU vira o nome a gravar, ou `null` se não serve.
//   - `nomeDoResponsavelConhecido`: o que está GRAVADO vira o nome a procurar, ou `null` se é o texto fixo / vazio.
//
// CÓPIA de `futboltalent_pro/supabase/functions/_shared/guardian_nome.ts` (a do servidor é a que vale: o formulário só
// recusa antes de enviar, para o responsável corrigir na hora). Mudou lá, mude aqui.

/** Os textos fixos que o app gravou no lugar do nome. Não são o nome de ninguém. */
const NOMES_FIXOS = new Set([
  "responsable legal",
  "responsavel legal",
  "responsable",
  "responsavel",
  "legal guardian",
  "guardian",
  "tutor",
  "tutor legal",
]);

// `new RegExp` e não literal: o tsconfig do site tem target ES2017, e o TypeScript recusa `\p{…}` em literal nesse target.
const MARCAS = new RegExp("\\p{M}", "gu");
const PERMITIDO = new RegExp("^[\\p{L}\\p{M}' ’.\\-]+$", "u");
const LETRA = new RegExp("\\p{L}", "u");

function semAcentoMinusculo(s: string): string {
  return s.normalize("NFD").replace(MARCAS, "").toLowerCase();
}

function limpar(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

export const NOME_RESPONSAVEL_MIN = 5;
export const NOME_RESPONSAVEL_MAX = 120;

/**
 * O nome que o responsável digitou, pronto para gravar — ou `null` se não serve.
 *
 * Serve: duas palavras ou mais (nome E sobrenome, que é o que o documento traz), só letras, espaço, apóstrofo, hífen e
 * ponto, de 5 a 120 caracteres. Não serve: um nome só, número, os textos fixos acima.
 */
export function normalizarNomeResponsavel(entrada: unknown): string | null {
  if (typeof entrada !== "string") return null;
  const nome = limpar(entrada);
  if (nome.length < NOME_RESPONSAVEL_MIN || nome.length > NOME_RESPONSAVEL_MAX) return null;
  if (!PERMITIDO.test(nome)) return null;
  const palavras = nome.split(" ").filter((p) => LETRA.test(p));
  if (palavras.length < 2) return null;
  if (NOMES_FIXOS.has(semAcentoMinusculo(nome))) return null;
  return nome;
}

/** O nome gravado em `guardians.name`, se for o nome de uma pessoa; `null` se vazio ou um dos textos fixos. */
export function nomeDoResponsavelConhecido(gravado: unknown): string | null {
  if (gravado === null || gravado === undefined) return null;
  const nome = limpar(String(gravado));
  if (!nome) return null;
  if (NOMES_FIXOS.has(semAcentoMinusculo(nome))) return null;
  return nome;
}
