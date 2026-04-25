---
tags: [tipo/adr, camada/frontend, tema/api-client]
tipo: adr
camada: frontend
status: implementado
created: 2026-04-24
---

# ADR-F02 — Cliente OpenAPI gerado automaticamente

## Status
aceito

## Contexto
Após [[ADR-B01 Migração GraphQL → REST]], o frontend precisava consumir ~40 endpoints REST. Escrever o cliente à mão significava drift constante entre backend e frontend, duplicação de tipos e bugs sutis de serialização.

## Decisão
Gerar cliente TypeScript automaticamente via **OpenAPI Generator** (em docker) lendo `docs-json` do NestJS Swagger.

- Script: `npm run generate:client`
- Endpoint fonte: `http://host.docker.internal:4000/docs-json`
- Saída: `src/client/` com `apis/`, `models/`, `docs/`, `runtime.ts`

Consumo via [[ApiManager]] (singleton) que instancia cada API com Configuration compartilhada (baseURL, accessToken).

## Consequências

### Positivas
- Type-safety ponta-a-ponta
- Zero drift entre backend e frontend
- Models e DTOs sempre sincronizados
- Docs automáticos em `src/client/docs/`

### Negativas
- Necessário regenerar após mudanças no backend
- Código gerado é menos legível que escrito à mão
- Dependência de docker para geração

### Trade-offs
- Escolhemos determinismo (gerado) sobre expressividade (artesanal)

## Alternativas consideradas
- **Cliente artesanal** — descartado: drift inevitável
- **tRPC** — descartado: exige monorepo integrado (backend é NestJS)
- **SWR/React Query com fetchers soltos** — descartado: perde tipos

## Referências
- [[Cliente OpenAPI gerado]]
- [[ApiManager]]
- [[ADR-B01 Migração GraphQL → REST]]
