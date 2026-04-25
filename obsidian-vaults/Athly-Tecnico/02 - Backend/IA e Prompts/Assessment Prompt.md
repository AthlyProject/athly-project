---
tags: [camada/backend, tipo/prompt]
camala: backend
tipo: prompt
status: implementado
created: 2026-04-24
---

# Prompt: Assessment

Avalia respostas de assessment e extrai insights (zones, experience level).

## 5 Sessões genéricas (RPE-based)

**Sessão 1**: Experiência de corrida
- Há quanto tempo corre?
- Qual é seu objetivo principal?

**Sessão 2**: Capacidade aeróbica
- Qual distância você corre confortavelmente?
- Qual seu pace médio?

**Sessão 3**: Zonas de esforço (RPE 1-10)
- Esforço fácil (RPE)?
- Esforço threshold (RPE)?
- Esforço VO2max (RPE)?

**Sessão 4**: Limitações físicas
- Tem lesões?
- Restrições médicas?

**Sessão 5**: Preferências
- Horário preferido para treinar?
- Quais dias da semana?

## Saída esperada (JSON)

```json
{
  "experienceLevel": "intermediate",
  "suggestedZones": {
    "z1": { "rpe_range": "1-3", "name": "easy" },
    "z2": { "rpe_range": "4-5", "name": "aerobic" },
    "z3": { "rpe_range": "6-7", "name": "tempo" },
    "z4": { "rpe_range": "8-9", "name": "threshold" },
    "z5": { "rpe_range": "10", "name": "vo2max" }
  },
  "restrictions": [],
  "preferredDays": ["monday", "wednesday", "saturday"]
}
```

---

Ver: [[assessment]], [[_MOC IA e Prompts]]
