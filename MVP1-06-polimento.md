# MVP1 · 🟡 Workstream 6 — Polimento / correções pontuais

> Itens pequenos mas que afetam credibilidade/qualidade percebida num launch público pago.

## Objetivo
Corrigir inconsistências e cruft que comprometem a qualidade: caloria com peso real, remover logs/
credenciais de debug, melhorar UX de permissão e dar feedback visível no envio de feedback.

## Itens, repos / arquivos afetados

### 1. Peso do usuário nas calorias — iOS
- `AthlyRunner/Services/RunTracker.swift` → `updateCalories()` usa `weightKg = 70.0` fixo.
- Ligar o peso real (coletado no cadastro) via `AuthViewModel`/profile → `RunViewModel` →
  `RunTracker` no início da corrida.
- Incluir peso na edição de perfil (`ProfileView`) para o usuário ajustar.

### 2. Remover logs de debug — backend
- `athly-backend/src/modules/workouts/workouts.service.ts` (`updateWorkout`): remover
  `console.log('chegou aqui')` e `console.log('workout', workout)`.

### 3. Remover credenciais demo hardcoded — frontend
- `athly-frontend/src/pages/LoginPage.tsx` — remover defaults `"alexandre@email.com"` / `"1234"`.

### 4. UX de permissão de localização negada — iOS
- Surfacing de `LocationManager.locationError` em `RunTrackingView`/`RunStartView`, com aviso claro
  e link para Ajustes quando a permissão for negada/restrita.

### 5. Confirmação de envio de feedback — iOS
- `Views/Plan/WorkoutCompletionSheet.swift` — trocar o `try?` silencioso por sucesso/erro visível
  (toast/estado) com opção de retry.

## Checklist
- [ ] Peso real do usuário usado no cálculo de calorias (sem 70kg fixo)
- [ ] Peso editável no perfil
- [ ] `console.log` de debug removidos do `workouts.service.ts`
- [ ] Credenciais demo removidas do `LoginPage.tsx`
- [ ] UX de permissão de localização negada implementada
- [ ] Feedback de treino mostra sucesso/erro (sem swallow silencioso)

## Critérios de aceite / verificação
- [ ] Calorias variam conforme o peso do usuário (testar com pesos diferentes)
- [ ] `grep "chegou aqui"` no backend não retorna nada
- [ ] Login web não tem credenciais pré-preenchidas
- [ ] Negar localização mostra aviso + caminho para Ajustes (não trava silenciosamente)
- [ ] Enviar feedback mostra confirmação; falha mostra erro/retry
- [ ] Backend `tsc` → exit 0; iOS `xcodebuild` → BUILD SUCCEEDED; frontend `npm run build` ok

## Dependências / observações
- Itens independentes entre si — podem ser feitos em qualquer ordem / por último.
- O nº 1 (peso) também depende de a edição de perfil expor o campo (overlap leve com WS2/perfil).
