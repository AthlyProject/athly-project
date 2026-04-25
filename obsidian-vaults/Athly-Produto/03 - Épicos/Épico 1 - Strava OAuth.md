---
tags: [tipo/epico, contexto/produto, integracao/strava]
status: doing
created: 2026-04-24
---

# Épico 1 — Strava OAuth

## Descrição

Implementar fluxo OAuth 2.0 com Strava para autenticar usuários per-user.

## Tasks Relacionadas

- [[TASK-001 - Variáveis de ambiente Strava]]
- [[TASK-002 - GET integrations strava auth]]
- [[TASK-003 - POST integrations strava callback]]
- [[TASK-004 - Botão Conectar Strava + OAuthCallbackPage]]

## Critérios de Aceite

✅ Usuário consegue clicar "Conectar Strava"  
✅ Redireciona para Strava OAuth  
✅ Retorna com authorization code  
✅ Backend troca code por accessToken + refreshToken  
✅ Tokens salvos em BD (Integration table)  
✅ Frontend mostra status "Conectado"  

## ADRs Relacionadas

- [[ADR-003 - OAuth per-user, não env var global]]

## Dependências

Nenhuma. Primeiro épico.

---

**Roadmap:** [[03 - Épicos/_MOC Épicos]]
