---
tags: [camada/frontend, tipo/documento]
camada: frontend
tipo: documento
status: implementado
created: 2026-04-24
---

# Store: useAuthStore

Persist em localStorage ('iafit-auth'). User + tokens.

## State

```ts
{
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  assessmentCompleted: boolean;
  isLoading: boolean;
  error?: string;
}
```

## Ações

- `setAuth(user, accessToken, refreshToken)` — login
- `logout()` — clear
- `refreshTokens()` — endpoint /auth/refresh
- `markAssessmentComplete()` — User.assessmentCompleted = true

---

Ver: [[_MOC Frontend]], [[Auth Flow (backend + frontend + iOS)]]
