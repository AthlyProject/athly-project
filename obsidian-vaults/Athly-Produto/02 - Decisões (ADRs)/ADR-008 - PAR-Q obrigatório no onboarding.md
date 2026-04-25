---
tags: [tipo/adr, contexto/produto, status/aceito]
status: done
created: 2026-04-24
adr_number: 8
---

# ADR-008 — PAR-Q Obrigatório no Onboarding

## Status
**Aceito** — Implementado em Seção 5 do onboarding

## Decisão

Toda nova conta **obrigatoriamente responde PAR-Q** antes de gerar primeiro plano.

**PAR-Q (Physical Activity Readiness Questionnaire):** 7 perguntas de screening de risco

```
1. Histórico de doença cardíaca?
2. Pressão alta?
3. Colesterol alto?
4. Diabetes ou açúcar elevado?
5. Ossos ou articulações problemáticas?
6. Tosse frequente ou falta de ar?
7. Outro motivo médico para não fazer exercício?
```

### Por quê?
✅ **Conformidade/Segurança:** Responsabilidade legal mínima  
✅ **Rastreabilidade:** Documenta awareness de risco  
✅ **Diferenciação:** Most apps ignoram isso  
✅ **IA melhor:** Contexto de saúde refina planos  

### Fluxo
```
Onboarding:
  1. Contextualização
  2. Atividades
  3. Planejamento
  4. Performance
  5. PAR-Q ← AQUI (bloqueador)
  6. Cadastro
  7. Aceite
  
Se PAR-Q = SIM a qualquer pergunta:
  → Alert: "Consulte médico antes de usar"
  → Opção: continuar (assumir risco) ou cancelar
```

---

## Referências

- [[06 - Onboarding/Seção 5 - PAR-Q]]
- [[06 - Onboarding/_MOC Onboarding]]
