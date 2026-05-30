# MVP1 · 🔴 Workstream 2 — Compliance + segurança iOS (App Store público)

> Alvo: submissão pública na App Store. Estes itens são **blockers de submissão** (rejeição) e de
> segurança.

## Objetivo
Deixar o app iOS aprovável na App Store e seguro: tokens no Keychain, exclusão de conta, Privacy
Manifest e links de privacidade/termos.

## Repos / arquivos afetados

### iOS (`athly-ios`)
- **Keychain:** `AthlyRunner/ViewModels/AuthViewModel.swift` — mover `athly_access_token` e
  `athly_refresh_token` de `UserDefaults` para Keychain (criar um `KeychainHelper` simples ou usar
  `Security` framework). Atualizar set/get/clear de tokens.
- **Excluir conta (UI):** `AthlyRunner/Views/Profile/ProfileView.swift` — seção "Conta" com botão
  "Excluir conta" + confirmação destrutiva → chama o novo endpoint → faz logout/limpa cache.
- **Privacy Manifest:** adicionar `AthlyRunner/PrivacyInfo.xcprivacy` ao target (e registrar no
  `project.yml`). Declarar: localização, dados de saúde, e "required reason APIs" (ex.: `UserDefaults`
  / file timestamp se aplicável).
- **Privacy Policy + Termos:** links no `ProfileView` (URLs hospedadas na landing do `athly-frontend`).

### Backend (`athly-backend`)
- **Excluir conta (endpoint):** `DELETE /users/me` em `users.controller.ts`/`users.service.ts` com
  **cascade**: training plans, weekly goals, workouts, workout feedback, run sessions (ver WS4),
  assessment, goals, integrations, sessions/refresh tokens. Verificar `onDelete: Cascade` no
  `schema.prisma` ou deletar em transação.

## Checklist
- [ ] `KeychainHelper` criado e `AuthViewModel` migrado de UserDefaults → Keychain
- [ ] Migração suave: na 1ª execução pós-update, ler token antigo do UserDefaults (se houver),
      gravar no Keychain e limpar o UserDefaults
- [ ] Endpoint `DELETE /users/me` com cascade completo (transação ou FKs cascade)
- [ ] UI "Excluir conta" no `ProfileView` com confirmação + logout pós-sucesso
- [ ] `PrivacyInfo.xcprivacy` adicionado ao target e ao `project.yml`
- [ ] Links de Privacidade e Termos no `ProfileView` (URLs da landing)

## Critérios de aceite / verificação
- [ ] Tokens não aparecem mais em `UserDefaults` (verificar em runtime); sessão persiste via Keychain
- [ ] Excluir conta remove o usuário e todos os dados associados no backend (checar no DB)
- [ ] Build valida o Privacy Manifest; submissão não acusa falta de manifesto/required-reason
- [ ] Links de privacidade/termos abrem corretamente
- [ ] iOS `xcodebuild` → BUILD SUCCEEDED; backend `tsc` → exit 0

## Dependências / observações
- O cascade de exclusão deve incluir o modelo de corrida do **WS4** (`RunSession`) — coordenar ordem.
- URLs de privacidade/termos dependem da landing (WS de web/landing) estar publicada.
