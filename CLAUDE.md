@AGENTS.md

# FutbolTalent — Guardian Web

## Visão Geral

Formulário web de autorização de menores da plataforma FutbolTalent Pro.
Acesso público (sem login) em: **https://guardian.futboltalent.pro**

Repositório principal do app Flutter: `futboltalent_pro`.

---

## Stack

- **Next.js 16** + TypeScript
- **Supabase JS SDK** — acesso com anon key (sem auth)
- **Tailwind CSS**
- **Jest + ts-jest** — testes unitários

---

## Estrutura

```
pages/
  index.tsx          # página única: verificação de código + formulário de consentimento
  _app.tsx
  _document.tsx
lib/
  auditLog.ts        # logGuardianAudit() — registra eventos na admin_audit_log
__tests__/
  guardianForms.test.ts   # testes de lógica de formulário e cálculo de idade
  auditLog.test.ts        # testes do audit log
__mocks__/
  next/router.ts     # mock do next/router para Jest
jest.config.js
```

---

## Fluxo do Formulário

1. Responsável recebe e-mail com link: `/?code=CODIGO&email=EMAIL`
2. `verifyCode` — chama Edge Function `verify-guardian-code`
3. Se válido, exibe formulário de consentimento
4. Upload de documentos via Edge Function `upload-guardian-doc` (base64)
5. `recordConsent` — chama Edge Function `record-guardian-consent`
6. Ambas as etapas registram eventos em `admin_audit_log` via `logGuardianAudit()`

---

## Variáveis de Ambiente

Arquivo `.env.local` na raiz:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Obtidas em: Supabase Dashboard → Settings → API.

---

## Audit Log

```typescript
import { logGuardianAudit } from '../lib/auditLog';

logGuardianAudit({
  action: 'guardian_code_verified',
  entityId: String(guardianId),
  entityLabel: playerName,
  details: { guardian_email, player_id },
});
```

Silencia erros — nunca bloqueia o fluxo principal.
Insere na tabela `admin_audit_log` com `actor_type = 'guardian_web'` e `admin_id = null`.

A RLS do Supabase permite inserção anônima apenas quando `actor_type = 'guardian_web'` e `admin_id IS NULL`.

---

## Storage de Documentos

Os documentos são enviados via Edge Function `upload-guardian-doc` para o bucket **privado** `guardian-documents` no Supabase Storage.

Path dos arquivos: `{guardian_id}/{tipo_doc}.{ext}`

O admin acessa via URL assinada (5 min) gerada pelo app Flutter. Não há URL pública.

---

## Regra de Documento de Vínculo

Obrigatório quando:
- Menor tem **15 anos ou menos** (qualquer vínculo)
- Menor tem **16–17 anos** com vínculo ≠ `madre` ou `padre`

---

## Comandos

```bash
npm install       # instalar dependências
npm run dev       # dev em localhost:3000
npm run build     # build de produção
npm test          # rodar testes Jest
```

---

## Deploy

Recomendado: **Vercel** conectado ao repositório GitHub.
Configurar as variáveis de ambiente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no painel da Vercel.
Deploy automático ao push na branch `main`.

---

## Observações Importantes

- O formulário não exige login — usa a anon key do Supabase
- O código de verificação (`approval_code`) tem validade limitada (`approval_code_expires_at`)
- Após consentimento aprovado, o guardian não pode reenviar — status é `approved`
- A RLS bloqueia qualquer tentativa de inserção que não seja `actor_type = 'guardian_web'` pela role `anon`
