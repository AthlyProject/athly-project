---
tags: [camada/all, tipo/moc]
camada: cross
tipo: moc
status: implementado
created: 2026-04-24
---

# Arquitetura Geral — MOC

Visão estrutural do Athly em 3 camadas + cross-cutting.

## Documentos principais

- [[Visão de 3 camadas]] — Camadas, responsabilidades, interfaces
- [[Stack Overview]] — Tecnologias por camada
- [[Fluxos cross-cutting]] — Casos de uso end-to-end
- [[Divergência IA Claude vs Gemini]] — Decisão IA (ADR-B03)

## Queries

```dataview
TABLE tipo, status FROM "01 - Arquitetura Geral" WHERE file.path CONTAINS "01 - Arquitetura" SORT file.name
```

---

**Links internos:**
- [[_MOC Backend|Backend →]] para módulos e modelos
- [[_MOC Frontend|Frontend →]] para telas e design
- [[_MOC iOS|iOS →]] para views e services
- [[_MOC Cross-cutting|Cross →]] para auth e fluxos
