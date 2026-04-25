---
tags: [camada/frontend, tipo/documento]
camada: frontend
tipo: documento
status: implementado
created: 2026-04-24
---

# Cliente OpenAPI gerado

Auto-gerado via docker + openapi-generator do Swagger do backend.

## Processo

1. Backend: /swagger/swagger-json
2. Docker: openapi-generator-cli
3. Output: `src/services/generated/`

## Tipos + métodos

Tipagem forte para all endpoints. Exemplo:

```ts
import { AuthApi } from './generated/apis/auth.api';

const api = new AuthApi();
const response = await api.authLogin({ email, password });
```

---

Ver: [[_MOC Frontend]], [[Stack Frontend]]
