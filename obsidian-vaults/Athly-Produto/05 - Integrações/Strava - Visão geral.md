---
tags: [tipo/integracao, integracao/strava, contexto/produto]
status: done
created: 2026-04-24
---

# Strava — Visão Geral

## O que é Strava?

Rede social para atletas. Usuários rastreiam corridas, bike, natação, etc. via GPS no smartphone/relógio.

**Athly sincroniza Strava** para puxar histórico real de atividades e usar como contexto para gerar planos IA.

---

## Fluxo Athly ↔ Strava

```
Usuário novo Athly
  ↓
"Conectar Strava?" (Modal)
  ↓
Click → OAuth 2.0
  ↓
Strava: "Athly quer access a atividades"
  ↓
Usuário: "Autorizar"
  ↓
Strava retorna code → Backend troca code por tokens
  ↓
Backend: "Autorizado. Sincronizando últimos 30 dias..."
  ↓
Fetch /athlete/activities → parse + upsert Workouts
  ↓
IA gera plano com histórico real
  ↓
Plano exibido com badges "🟦 Strava" nos workouts reais
```

---

## Scope & Permissões

```
scope=activity:read_all
```

Permite:
- ✅ Ler todas as atividades do usuário
- ✅ Ler metadados (modalidade, distância, duração, altitude)
- ❌ Não permite escrever/deletar

---

## Janela de Sync

- **Sempre:** últimos 30 dias
- **Cron:** toda segunda-feira 6h
- **Manual:** botão "Sincronizar agora" em Settings

---

## Relação com Athly

| Aspecto | Descrição |
| --- | --- |
| **Per-user** | Cada usuário tem próprio token Strava |
| **Automático** | Sync semanal via cron |
| **Opcional** | Fallback Assessment Plan sem Strava |
| **Transparente** | Badges visuais indicam origem (Strava/IA/Manual) |

---

## Referências

- [[Strava - Fluxo OAuth]]
- [[Strava - Sync de atividades]]
- [[ADR-003 - OAuth per-user, não env var global]]
