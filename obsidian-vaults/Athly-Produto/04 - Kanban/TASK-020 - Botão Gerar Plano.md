---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 8 - Frontend Integration"
prioridade: media
---

# TASK-020 — Botão Gerar Plano

## Descrição

Frontend: botão que dispara geração manual de novo plano.

## Critérios de Aceite

- [ ] Botão "Gerar Novo Plano" na PlanPage
- [ ] Valida Strava conectado (se não, mostra modal StravaAuthModal)
- [ ] Click → POST `/training-plans/generate`
- [ ] Loading spinner enquanto processa
- [ ] Success: plano novo com toast "Plano gerado com sucesso!"
- [ ] Error: mensagem clara + retry option
- [ ] Disable botão durante request (evitar duplicatas)

## Fluxo

```
Click "Gerar Novo Plano"
  ↓
Strava conectado?
  ├─ NÃO → Modal: "Conecte Strava primeiro"
  └─ SIM → POST /training-plans/generate
      ↓
      Loading...
      ↓
      Sucesso → Toast + refresh page
      Erro → Error message + retry
```

## Referências

- TASK-015
- [[Strava - Modal obrigatória (StravaAuthModal)]]
