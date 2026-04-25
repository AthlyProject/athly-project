---
tags: [tipo/view, camada/ios, dominio/auth]
tipo: view
camada: ios
status: implementado
created: 2026-04-24
---

# Auth Views

## Propósito
Conjunto de telas de autenticação do app iOS: login por email/senha, cadastro inicial e, futuramente, recuperação de senha.

## Views incluídas
- `LoginView`
- `RegisterView`
- `WelcomeView` (landing pós-splash)
- `PasswordResetView` (planejado)

## ViewModel
- [[AuthViewModel]]

## Dependências
- [[APIClient]]
- [[Components reutilizáveis]] (TextField estilizado, botão primário)

## Fluxo
1. Launch → `WelcomeView`
2. Tap em "Entrar" → `LoginView`
3. Tap em "Criar conta" → `RegisterView`
4. Sucesso → [[Root e MainTab]] (via [[AuthViewModel]] isAuthenticated)

## Notas
- Validação inline dos campos (email regex, senha mínimo 8)
- Mensagens de erro vindas de [[AuthViewModel]].errorMessage
