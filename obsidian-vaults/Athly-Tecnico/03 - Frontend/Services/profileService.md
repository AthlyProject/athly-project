---
tags: [tipo/servico, camada/frontend, dominio/usuario]
tipo: servico
camada: frontend
arquivo: src/services/profileService.ts
status: implementado
created: 2026-04-24
---

# profileService

## Propósito
Gerenciar leitura e atualização do perfil do usuário logado.

## API pública

| Método | Endpoint |
|--------|----------|
| `getProfile()` | [[GET users-me]] |
| `updateProfile(input)` | [[PUT users-profile]] |

## Consumido por
- [[ProfilePage]]
- [[AssessmentPage]] (dados iniciais de peso, altura, nascimento)

## Campos atualizáveis
- name, email
- dateOfBirth, weight, height
- goals, availableDays
- role (apenas admin)

## Tratamento de erros
- try/catch com fallback null
- Validação lado cliente via Zod antes do submit

## Notas
- Atualiza [[useAuthStore]] ao mudar dados básicos do user
