---
tags: [tipo/visao, contexto/produto]
status: done
created: 2026-04-24
---

# Loop do MVP — Visão Detalhada

## 5 Etapas Principais

### 1️⃣ Conectar Strava

**Ator:** Usuário novo  
**Ação:** Clica em "Conectar Strava"  
**Sistema:** Redireciona para OAuth Strava → usuário aceita → volta ao app

**Tecnicamente:**
- POST `/integrations/strava/auth` → gera URL OAuth
- GET `/integrations/strava/callback` → valida code, salva tokens (access + refresh)
- Tokens armazenados em `Integration` table (stravaAccessToken, stravaRefreshToken, expiresAt)

**Saída:** `accessToken` válido para ler atividades

---

### 2️⃣ Sincronizar Atividades

**Ator:** Cron automático (seg 6h) ou manual (Settings)  
**Ação:** Fetch últimos 30 dias de atividades Strava

**Tecnicamente:**
- Chamar `GET /activities?after=<30d_ago>&per_page=200`
- Para cada atividade:
  - Mapeamento modalidade (Run → running, Bike → cycling, etc.)
  - Criar `Workout` com `stravaActivityId` UNIQUE
  - Evita duplicatas via UNIQUE constraint
- Refresh automático de token 5 min antes de expirar

**Saída:** Banco de dados com ~10-30 workouts reais do mês

---

### 3️⃣ Gerar Plano IA

**Ator:** Cron automático (seg 6h) ou manual (botão "Gerar Plano")  
**Ação:** Chamar IA (Claude/Gemini) com contexto

**Contexto enviado à IA:**
- Histórico de 30 dias (workouts Strava)
- Preferências do usuário: goals, availability (seg-dom), PAR-Q, data início
- Performance: melhor tempo em 10km, qualidade sono, dor crônica
- Dados físicos: idade, peso, altura, gênero

**IA retorna:** JSON com 7 workouts (seg-dom)
```json
{
  "week_starting": "2026-04-28",
  "workouts": [
    {
      "day": "monday",
      "type": "easy_run",
      "distance_km": 5,
      "duration_minutes": 35,
      "notes": "..."
    }
  ]
}
```

**Armazenamento:** `TrainingPlan` + `Workout` (modalidade = "ai_generated")

**Saída:** Plano estruturado na BD, ready para exibir

---

### 4️⃣ Exibir Plano

**Ator:** Usuário abrir aplicativo  
**Ação:** Visualiza dashboard com plano semanal

**Interface:**
- 7 cards (mon-sun) com:
  - Tipo de treino (easy run, tempo run, long run, etc.)
  - Distância, duração, notas
  - Badge origem: 🟦 Strava | 🤖 IA | ✏️ Manual
- Botão editar → sobrescreve IA com Manual
- Botão "Gerar novo plano" → chamada ad-hoc

**Saída:** Plano transparente e editável

---

### 5️⃣ Repetir (Automático)

**Ator:** Cron (seg 6h, **0 6 * * 1**)  
**Ação:** Resync Strava → regenera plano → notifica usuário

**Fluxo:**
1. Fetch atividades últimos 30 dias
2. Atualiza workouts com `stravaActivityId` novos
3. Chama IA com histórico atualizado
4. Sobrescreve `TrainingPlan` anterior
5. Envia notificação (push/email): "Novo plano disponível"

**Resultado:** Semana seguinte tem plano fresco baseado em progresso real

---

## Decisão Crítica: Strava vs Fallback

```
usuário novo
  ↓
quer conectar Strava?
  ├─ SIM → Cron sincroniza, IA usa histórico
  └─ NÃO → Assessment Plan (5 treinos genéricos) → coleta preferências
```

---

## Critério de Sucesso MVP

✅ Loop completo funcionando (Conectar → Repetir)  
✅ Planos baseados em histórico real (Strava)  
✅ Automação semanal (cron)  
✅ Badges visuais (Strava/IA/Manual)  
✅ Fallback sem Strava (Assessment Plan)  

---

**Relacionado:** [[Proposta de Valor]], [[Visão do Produto]], [[Loop do MVP.canvas]]
