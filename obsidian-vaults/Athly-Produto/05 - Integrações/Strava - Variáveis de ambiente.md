---
tags: [tipo/integracao, integracao/strava, contexto/produto]
status: done
created: 2026-04-24
---

# Strava — Variáveis de Ambiente

Configurações necessárias para integrar Strava OAuth no Athly.

---

## .env (Desenvolvimento)

```bash
# Strava OAuth
STRAVA_CLIENT_ID=123456
STRAVA_CLIENT_SECRET=abc123xyz...
STRAVA_REDIRECT_URI=http://localhost:3000/integrations/strava/callback

# Strava API
STRAVA_API_BASE_URL=https://www.strava.com/api/v3
```

---

## .env.staging

```bash
STRAVA_CLIENT_ID=<staging_client_id>
STRAVA_CLIENT_SECRET=<staging_client_secret>
STRAVA_REDIRECT_URI=https://staging.athly.com/integrations/strava/callback
STRAVA_API_BASE_URL=https://www.strava.com/api/v3
```

---

## .env.production

```bash
STRAVA_CLIENT_ID=<prod_client_id>
STRAVA_CLIENT_SECRET=<prod_client_secret>
STRAVA_REDIRECT_URI=https://athly.com/integrations/strava/callback
STRAVA_API_BASE_URL=https://www.strava.com/api/v3
```

---

## Obter Credenciais

1. **Acessar:** https://www.strava.com/settings/apps
2. **Login:** Conta Strava do desenvolvedor
3. **"Create New App"**
4. **Preencher:**
   - App Name: "Athly Dev" (ou "Athly Prod")
   - Website: https://athly.com
   - Authorization Redirect Domain(s): 
     - localhost (dev)
     - staging.athly.com (staging)
     - athly.com (prod)
5. **Copy:** Client ID, Client Secret

---

## Validação no App

```typescript
// TASK-001: Validar vars no startup
export class AppModule {
  constructor(private configService: ConfigService) {
    const required = [
      'STRAVA_CLIENT_ID',
      'STRAVA_CLIENT_SECRET',
      'STRAVA_REDIRECT_URI',
    ];
    for (const key of required) {
      if (!this.configService.get(key)) {
        throw new Error(`Missing env var: ${key}`);
      }
    }
  }
}
```

---

## Segurança

⚠️ **Never commit .env files**  
⚠️ **Client Secret é secreto!** (só no backend)  
✅ **Client ID pode ser público** (usado no frontend para gerar URL)

---

## Referências

- TASK-001
- [[Strava - Fluxo OAuth]]
