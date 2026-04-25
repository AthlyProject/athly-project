---
tags: [tipo/integracao, contexto/produto]
status: done
created: 
---

# [Nome Integração] — [Subtópico]

## O que é?

[Descrição breve do serviço/API externo]

---

## Contexto

[Por que integrar? Que valor agrega?]

[Como é usado no Athly]

---

## Configuração

### Variáveis de Ambiente

```bash
API_KEY=xxx
API_SECRET=yyy
API_BASE_URL=https://...
```

### Credenciais

[Como obter credenciais]

[Links para painel de desenvolvedor]

---

## Fluxo Principal

```
[ASCII diagram ou descrição]

Passo 1
  ↓
Passo 2
  ↓
Resultado
```

---

## API Endpoints Usados

| Método | Endpoint | Propósito |
| --- | --- | --- |
| GET | /resource | Buscar |
| POST | /resource | Criar |
| PUT | /resource/:id | Atualizar |

---

## Estruturas de Dados

### Request

```json
{
  "param1": "valor",
  "param2": 123
}
```

### Response

```json
{
  "status": "success",
  "data": { ... }
}
```

---

## Tratamento de Erros

| Código | Significado | Retry? |
| --- | --- | --- |
| 429 | Rate limit | Sim (backoff) |
| 401 | Autenticação | Não |
| 500 | Server error | Sim (3x) |

---

## Testes

[Como testar com mock data]

[Fixtures / dados de teste]

---

## Referências

- [[Página relacionada]]
- [[ADR-XX]]
- TASK-XXX

---

**Status:** [implementado | pendente | descontinuado]  
**Owner:** [Nome]  
