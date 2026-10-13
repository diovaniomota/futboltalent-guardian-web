# FutbolTalent Guardian Web

Web version para que responsables legales autoricen cuentas de menores y envíen documentos.

## Features

- ✅ Verificación de código + email del responsable
- ✅ Upload de documentos (menor + responsable)
- ✅ Aceptación de términos y privacidad
- ✅ Auto-relleno desde URL: `?code=RESP-7K2M9QX4TB3N&email=responsable@mail.com`
- ✅ Integración con Supabase Edge Functions existentes

## Setup

```bash
npm install
npm run dev
# Abre http://localhost:3000
```

## Variables de ambiente

`.env.local` ya tiene las credenciales de Supabase apuntadas al proyecto futboltalent_pro.

## URL de producción

Hospedar en:
- **Cloudflare Pages** (recomendado): `https://guardian.futboltalent.pro`
- **Vercel**: `https://guardian.futboltalent.pro` (CNAME en DNS)

## Email del guardian

El link en el email que recibe el responsable debe ser:
```
https://guardian.futboltalent.pro/?code=RESP-7K2M9QX4TB3N&email=responsable@email.com
```

Los parámetros se auto-rellenan en el formulario, pero el responsable puede editarlos manualmente.

## Flujo

1. Guardian clica el link del email
2. Código + email se pre-llenan automáticamente
3. Guardian verifica su identidad
4. Selecciona relación (padre, madre, tutor, etc)
5. Sube documento del menor (DNI/cédula)
6. Sube su documento (DNI/cédula)
7. Acepta términos
8. Autoriza → documentos se guardan en Supabase, menor recibe email
