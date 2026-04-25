---
tags: [tipo/adr, contexto/produto, status/aceito]
status: done
created: 2026-04-24
adr_number: 4
---

# ADR-004 — Regeneração Automática Semanal via Cron

## Status
**Aceito** — Implementado em TASK-017, TASK-018

## Contexto

Athly promete "loop fechado" que repete automaticamente. Mas qual a frequência?

**Opções:**
- Diária: muito overhead
- Semanal: balanceado (novo contexto, sem excesso)
- Por demanda: manual, perde automação

## Decisão

**Toda segunda-feira, 6h da manhã** (UTC-3 São Paulo, ou local do servidor)

Cron expression: `0 6 * * 1`

### Por quê segunda-feira 6h?

- **Segunda-feira:** Início da semana. Plano novo reflete trabalho do fim de semana
- **6h:** Cedo, antes de usuário acordar. Notificação chega ao amanhecer
- **Recorrência:** Semanal é frequência mínima para "sempre fresco" sem overhead

## Fluxo Automático

```
Seg 6h (cron trigger)
  ↓
Para cada User com Integration.stravaAccessToken válido:
  ↓
  1. Refresh token se expirado
  2. Fetch últimos 30 dias (Strava API)
  3. Upsert Workouts (stravaActivityId UNIQUE)
  4. Chamar IA: histórico + preferências → novo TrainingPlan
  5. Substitui plan anterior
  6. Envia notificação push/email: "Seu novo plano de treino!"
```

## Consequências

### Positivas
✅ Automático: zero esforço do usuário  
✅ Semanal: fresco, mas não agressivo  
✅ Determinístico: mesma hora toda semana (experiência previsível)  
✅ Histórico sempre atualizado (últimos 30 dias)  

### Negativas
❌ Pode sobrecarregar servidor (todos os usuários ao mesmo tempo)  
❌ Latência IA multiplicada por num_users  
❌ Se cron falhar, plano não regenera por semana inteira  

### Mitigações
- Distribuir cron com jitter (pequeno delay aleatório)
- Retry logic (3 tentativas)
- Fallback manual (botão "Gerar Plano" no app)

## Alternativas Consideradas

### 1. Diária (0 6 * * *)
- ❌ Overhead 7x maior
- ❌ Plano muito parecido dia-a-dia (sem valor novo)
- ❌ Rate limit Strava pode ser violado

### 2. Por Demanda (manual)
- ❌ Sem automação, perde diferencial
- ❌ Usuário precisa se lembrar de clicar
- ❌ Fidelidade cai

### 3. Quando usuário abre app
- ❌ Latência perceprível (sync + IA lento)
- ❌ Variável por usuário (nada determinístico)

---

## Implementação (NestJS)

```typescript
// TASK-018
@Cron('0 6 * * 1') // Seg 6h
async regenerateWeeklyPlans() {
  const users = await userService.findAllWithStrava();
  for (const user of users) {
    try {
      // Refresh token se needed
      await stravaService.refreshTokenIfExpired(user.id);
      
      // Sync atividades
      await stravaService.syncActivities(user.id);
      
      // Gerar plano novo
      const plan = await aiService.generateWeeklyPlan(user.id);
      
      // Salvar
      await trainingPlanService.upsert(user.id, plan);
      
      // Notificar
      await notificationService.send(user.id, 'Novo plano disponível!');
    } catch (error) {
      logger.error(`Cron failed for user ${user.id}:`, error);
      // Retry ou alert manual
    }
  }
}
```

---

## Referências

- [[03 - Épicos/Épico 7 - Weekly Loop (Cron)]]
- TASK-017 (Instalar @nestjs/schedule)
- TASK-018 (Cron job semanal)
- [[Loop do MVP]]
