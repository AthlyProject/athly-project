# MVP1 · 🔴 Workstream 1 — Remover Strava (cross-repo)

> Regra de produto: remover todas as referências a Strava antes do launch. Só Apple Health
> (e Health Connect no futuro). Hoje o Strava ainda está **vivo** em backend, frontend e
> (cosmético) no iOS.

## Objetivo
Eliminar toda integração Strava (código vivo, endpoints, UI, env e CLI legado) dos três repos,
sem quebrar build/typecheck, mantendo as colunas de DB como dormentes para evitar migração
arriscada no MVP.

## Repos / arquivos afetados

### Backend (`athly-backend`)
- Apagar módulo: `src/modules/strava/` (`strava.module.ts`, `strava.service.ts`, `strava.mapper.ts`).
- `src/modules/integrations/integrations.controller.ts` e `integrations.service.ts` — remover
  endpoints e lógica OAuth/sync de Strava.
- `src/modules/auth/auth.{controller,service,module}.ts` — remover `getStravaAuthUrl()`,
  `stravaLogin()`, import de `StravaService`/`StravaModule` e endpoints OAuth Strava.
- `src/modules/ai-planner/ai-planner.service.ts` — remover o caminho de geração baseado em Strava
  (`planNextWeek()` / `stravaService.getRecentActivities()`); manter `planFromHealth()`.
- Apagar CLI legado fora do build: `src/stravaClient.ts` e `src/tools/*` (Strava tools).
- `.env.example` / configs de CI / Railway — remover `STRAVA_CLIENT_ID/SECRET/REDIRECT_URI/ACCESS_TOKEN`.

### Frontend (`athly-frontend`)
- Apagar `src/components/StravaAuthModal.tsx`.
- `src/pages/LoginPage.tsx` — remover botão "Continuar com Strava".
- `src/pages/DashboardPage.tsx` — remover o modal de conectar Strava no load.
- `src/pages/OAuthCallbackPage.tsx` + rota `/oauth/strava/callback` no `src/router/index.tsx`.
- `src/services/integrationService.ts` — remover `initiateStravaOAuth/handleStravaCallback/
  syncStrava/disconnectStrava/isStravaConnected`.
- Landing — garantir copy só com "Apple Health / Health Connect".

### iOS (`athly-ios`)
- `AthlyRunner/Views/Components/WorkoutCardView.swift` — remover o badge cosmético quando
  `stravaActivityId != nil`.
- `AthlyRunner/Models/APIModels.swift` — `stravaActivityId` pode permanecer (decodável, inofensivo).

### DB (decisão)
- **Manter** `Workout.stravaActivityId` e `Integration.stravaAthleteId` como nullable dormentes
  (sem migração agora). Remoção real fica para MVP2 se desejado.

## Checklist
- [ ] Backend: módulo `strava/` removido e sem imports órfãos
- [ ] Backend: endpoints/lógica Strava removidos de `integrations` e `auth`
- [ ] Backend: caminho Strava removido do `ai-planner` (mantendo `planFromHealth`)
- [ ] Backend: `stravaClient.ts` + `src/tools/*` apagados
- [ ] Backend: `STRAVA_*` removidos de `.env.example` e CI
- [ ] Frontend: `StravaAuthModal`, botão de login, modal do dashboard e rota OAuth removidos
- [ ] Frontend: métodos Strava removidos de `integrationService.ts`
- [ ] iOS: badge Strava removido do `WorkoutCardView`
- [ ] Decisão de DB registrada (colunas dormentes mantidas)

## Critérios de aceite / verificação
- [ ] `grep -ri strava` nos 3 repos não retorna **código vivo** (só, se mantido, colunas/campos de DB dormentes)
- [ ] Backend: `npx tsc --noEmit -p tsconfig.build.json` → exit 0
- [ ] Frontend: `npm run build` ok
- [ ] iOS: `xcodebuild ... -scheme AthlyRunner` → BUILD SUCCEEDED
- [ ] Fluxos de login/dashboard/onboarding funcionam sem nenhuma menção a Strava

## Dependências / observações
- Sem dependência de outros workstreams. Bom **primeiro** item (baixo risco, regra de produto).
- Memória do projeto: "No Strava until launch".
