---
tags: [tipo/proposta, contexto/produto]
status: done
created: 2026-04-24
---

# Proposta de Valor — Athly

## Loop Fechado

**Conectar → Sincronizar → Gerar → Exibir → Repetir**

Diferente de plataformas que exigem entrada manual ou sincronização ocasional, Athly fecha um loop contínuo.

### Etapa 1: Conectar

- OAuth 2.0 com Strava (per-user, não global)
- Scope: `activity:read_all`
- Refresh automático e transparente

**Valor:** Conexão segura e confortável — usuário não compartilha senha

---

### Etapa 2: Sincronizar

- Fetch últimos 30 dias de atividades (cron automático)
- Mapeamento de modalidades (Run/TrailRun → running, Bike → cycling, etc.)
- `stravaActivityId` UNIQUE previne duplicatas

**Valor:** Histórico real, não estimado ou reportado manualmente

---

### Etapa 3: Gerar

- Chamada IA (Claude Sonnet 4.6 ou Gemini 2.5-flash)
- Contexto: histórico Strava + preferências do usuário (goals, availability, PAR-Q)
- Output: 7 workouts estruturados (mon-sun)

**Valor:** Plano personalizadocriado em segundos, não horas

---

### Etapa 4: Exibir

- Dashboard com plano semanal
- Badges visuais: 🟦 Strava (sincronizado), 🤖 IA (gerado), ✏️ Manual (editado)
- Edição manual allowed (override IA)

**Valor:** Transparência + controle do usuário

---

### Etapa 5: Repetir

- Cron automático **toda segunda-feira 6h** (0 6 * * 1)
- Resync Strava → regenera plano
- Sem intervenção do usuário

**Valor:** Plano sempre fresco, sempre personalizado

---

## Diferencial Competitivo

| Feature | Athly | Genéricos | Especialistas |
| --- | --- | --- | --- |
| **Loop fechado** | ✅ | ❌ | ❌ |
| **Sincroniza Strava auto** | ✅ | ❌ | ❌ |
| **Planos IA** | ✅ | Parcial | ❌ |
| **Regeneração semanal** | ✅ | Manual | Manual |
| **Badges origem** | ✅ | ❌ | ❌ |
| **Fallback sem Strava** | ✅ | ✅ | Não |

---

## Fallback: Assessment Plan

Se usuário não conecta Strava:
- 5 treinos genéricos (introdutório)
- Coleta de preferências para refinar
- Valida PAR-Q obrigatório
- Permite conexão Strava depois (resync automático)

**Valor:** Ninguém fica sem plano

---

**Relacionado:** [[Visão do Produto]], [[Loop do MVP]]
