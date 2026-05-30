# MVP1 · 🔴 Workstream 4 — Corrigir persistência de corrida no servidor

> Bug atual: o iOS faz `saveRun → POST /workouts`, mas `CreateWorkoutDto` exige
> `trainingPlanId`/`title`/`status` e **não tem** campos de métrica (distância, duração, rota,
> splits). A sincronização **falha sempre** e cai no "Salvo localmente". Histórico só existe no
> JSON local (`RunStore`), perdido em reinstalação — inaceitável para app pago em launch público.

## Objetivo
Persistir corridas concluídas no servidor (métricas + rota + splits), com histórico que sobrevive
a reinstalação, e apontar o iOS para os novos endpoints.

## Repos / arquivos afetados

### Backend (`athly-backend`) — novo módulo `src/modules/runs/*`
- **Prisma:** modelo `RunSession` (ou `Activity`): `userId`, `sportType`, `startDate`, `endDate`,
  `distanceMeters`, `durationSeconds`, `avgPaceSecondsPerKm`, `elevationGainMeters`, `calories`,
  `route` (JSON: lat/lng/alt/ts), `splits` (JSON), `appleHealthWorkoutUUID?`, `workoutId?`
  (link opcional ao treino prescrito), timestamps. Migração Prisma.
- **Endpoints:** `POST /runs` (cria a sessão) e `GET /runs/history` (lista do usuário).
- DTOs: `CreateRunDto` (espelha o `SaveRunRequest` do iOS) + response model.
- Incluir `RunSession` no cascade de **exclusão de conta** (WS2).

### iOS (`athly-ios`)
- `Services/APIClient.swift` — `saveRun` (linha ~58) passa a chamar `POST /runs`; `getRunHistory`
  (linha ~62) passa a usar `GET /runs/history`.
- `ViewModels/RunViewModel.saveRun` — ajustar mapeamento se necessário; manter o save local como
  fallback offline e marcar `synced` corretamente.
- Garantir que o histórico exibido possa vir do servidor (merge com local) — ou ao menos que o
  servidor seja a fonte durável.

## Checklist
- [ ] Modelo `RunSession` + migração Prisma
- [ ] `POST /runs` (cria) e `GET /runs/history` (lista) implementados e autenticados
- [ ] `CreateRunDto`/response alinhados ao `SaveRunRequest` do iOS
- [ ] iOS `saveRun`/`getRunHistory` apontando para os novos endpoints
- [ ] Fallback offline preservado (salva local, sincroniza depois, seta `synced`)
- [ ] `RunSession` incluído no cascade de exclusão de conta (WS2)

## Critérios de aceite / verificação
- [ ] Finalizar uma corrida → registro aparece no DB com métricas + rota + splits
- [ ] `GET /runs/history` retorna as corridas do usuário (e **sobrevive a reinstalar o app**)
- [ ] `saveRun` não cai mais no erro "Salvo localmente" quando online
- [ ] Backend `tsc` → exit 0; iOS `xcodebuild` → BUILD SUCCEEDED

## Dependências / observações
- Coordenar com **WS2** (incluir `RunSession` no cascade de exclusão de conta).
- É a **fatia mínima de correção**; o "store de saúde server-side" (MVP2) generaliza para ingestão
  de todos os dados de saúde (inclusive treinos externos) + import em lote + séries full-resolution.
- Maior item de correção do MVP1 — pode ser feito em paralelo aos demais.
