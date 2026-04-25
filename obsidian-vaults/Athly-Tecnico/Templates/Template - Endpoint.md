---
tags: [tipo/endpoint, camada/backend, metodo/{{metodo}}]
tipo: endpoint
camada: backend
metodo: GET | POST | PUT | PATCH | DELETE
path: /caminho/do/endpoint
modulo: {{modulo}}
auth_required: true | false
status: implementado
created: {{date}}
---

# {{METODO}} {{path}}

## Resumo
Uma linha sobre o que o endpoint faz.

## Autenticação
- Header `Authorization: Bearer <accessToken>`
- Guard: `JwtAuthGuard`

## Request

### Path params
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
|  |  |  |  |

### Query params
| Nome | Tipo | Default | Descrição |
|------|------|---------|-----------|
|  |  |  |  |

### Body (JSON)
```json
{
}
```

## Response 200
```json
{
}
```

## Possíveis erros
| Status | Quando | Mensagem |
|--------|--------|----------|
| 400 | Validação falhou |  |
| 401 | Token inválido |  |
| 404 | Recurso não encontrado |  |

## DTOs relacionados
- [[]]

## Fluxo interno
1. Controller recebe
2. Valida via class-validator
3. Service executa
4. Retorna

## Notas
- 
