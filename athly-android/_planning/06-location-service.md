# 06 — Serviço de localização + foreground service

## 1. Objetivo
Localização de alta precisão que sobrevive à tela bloqueada/background, expondo um `Flow<Location>` ordenado
com **todos** os pontos de cada lote (não coalescidos), espelhando o `LocationManager` do iOS.

## 2. Stack & convenções
Ver `README.md`. Tudo em `core/location/`. `FusedLocationProviderClient` (Google Play Services Location) +
um Foreground Service. Coroutines + Flow.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Services/LocationManager.swift`
> **Comportamento:** `CLLocationManager` configurado com `desiredAccuracy=bestForNavigation`,
> `distanceFilter=5m`, `activityType=fitness`, `allowsBackgroundLocationUpdates=true`,
> `pausesLocationUpdatesAutomatically=false`, `showsBackgroundLocationIndicator=true`. Pede permissão
> WhenInUse e, separadamente, Always. Emite **dois** fluxos: `currentLocation` (último ponto, coalescido —
> mapa pré-corrida) e `locationUpdates` (Subject com **TODOS** os pontos aceitos). No callback
> `didUpdateLocations`, o iOS pode entregar **vários pontos de uma vez** (lote acumulado com a tela
> bloqueada): filtra `horizontalAccuracy ∈ [0, 30)`, **ordena por timestamp** e emite **cada um** em ordem
> (não pega só `.last`). `hasPermission` = WhenInUse ou Always.

## 4. Alvo Android
### `core/location/LocationDataSource.kt`
- `FusedLocationProviderClient` com `LocationRequest` de **alta precisão** (`Priority.HIGH_ACCURACY`),
  intervalo ~**1s**, `minUpdateDistanceMeters = 5f` (espelha `distanceFilter`). Sem coalescer.
- Expõe `fun locationFlow(): Flow<Location>` (callbackFlow): em cada `LocationResult`, pega
  `result.locations`, filtra `accuracy in 0f..<30f`, **ordena por `time`** e **emite cada ponto** em ordem
  (espelha o lote do iOS). Opcional `currentLocation: StateFlow<Location?>` (último ponto, pré-corrida).

### `core/location/RunLocationService.kt` (Foreground Service)
- `foregroundServiceType="location"` no manifesto; `startForeground(...)` com uma notificação (a notificação
  **viva/oficial** vem no prompt 11 — aqui basta uma mínima para satisfazer o FGS). Mantém o
  `LocationDataSource` ativo para o tracking **sobreviver a screen lock/background**. `start()`/`stop()`.
  Expõe o `Flow<Location>` para o `RunTracker` (07) consumir (binder ou repositório singleton).

### `core/location/LocationPermissionController.kt` (+ helper de UI)
- Fluxo de permissões em runtime, **em etapas**:
  1. `ACCESS_FINE_LOCATION` (e `ACCESS_COARSE_LOCATION`).
  2. **Depois** (Android 10+/API 29+) `ACCESS_BACKGROUND_LOCATION` como **segundo pedido separado** (não pode
     ir junto do fine).
  3. `POST_NOTIFICATIONS` (Android 13+/API 33) para a notificação do FGS.
- Helpers `hasForegroundLocation()`, `hasBackgroundLocation()`, `hasNotificationPermission()`.

### Manifesto
- Permissões: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`.
- `<service android:name=".../RunLocationService" android:foregroundServiceType="location" .../>`.

### Mapeamento de plataforma
| iOS / CoreLocation | Android |
|---|---|
| `CLLocationManager` bg (`UIBackgroundModes: location`) | `FusedLocationProviderClient` + **Foreground Service** |
| `desiredAccuracy=bestForNavigation` | `Priority.HIGH_ACCURACY` |
| `distanceFilter=5` | `minUpdateDistanceMeters=5f` |
| `activityType=.fitness` | (sem equivalente direto — usar HIGH_ACCURACY + intervalo ~1s) |
| `allowsBackgroundLocationUpdates` + `pausesLocationUpdatesAutomatically=false` | FGS + sem auto-pause |
| `showsBackgroundLocationIndicator` | notificação contínua do FGS |
| WhenInUse vs Always | `ACCESS_FINE_LOCATION` vs `ACCESS_BACKGROUND_LOCATION` (2 pedidos) |
| `PassthroughSubject<CLLocation>` (todos os pontos) | `Flow<Location>` (callbackFlow, todos os pontos) |
| `@Published currentLocation` | `StateFlow<Location?>` |

## 5. Contrato de dados
Sem rede. Produz `android.location.Location` (mapeado para `RoutePoint`/domínio no 07/03).

## 6. Escopo
**In:** `LocationDataSource` (Flow ordenado de todos os pontos), Foreground Service de tracking, fluxo de
permissões em etapas, entradas de manifesto. **Fora:** cálculo de distância/pace/splits (07), a notificação
viva definitiva (11), UI da corrida (08).

## 7. Dependências
`00-foundation`.

## 8. Critérios de aceite
- Compila. Com permissão fine concedida, `locationFlow()` emite pontos durante a caminhada (intervalo ~1s,
  filtro de 5m).
- O Foreground Service mantém as atualizações com a **tela bloqueada/app em background** (notificação visível).
- Quando o sistema entrega um lote, **todos** os pontos válidos são emitidos **em ordem de tempo** (não só o último).
- Background-location é pedido como **segundo** request separado em API 29+; `POST_NOTIFICATIONS` em API 33+.

## 9. Pitfalls
- **Background-location é um segundo pedido**: não solicitar junto do fine (o sistema nega). Pedir fine →
  depois background.
- FGS do tipo `location` exige **notificação** + a permissão de runtime; sem isso o serviço crasha ao iniciar
  (API 34+ é estrito quanto ao `foregroundServiceType`).
- **Emitir cada ponto do lote** ordenado por `time` — não pegar só `locations.last` (perderia pontos do
  desbloqueio, como o iOS evita).
- Doze/otimização de bateria pode estrangular updates: confiar no FGS e em HIGH_ACCURACY; documentar limitação.
- Filtro de precisão `[0,30)m` idêntico ao iOS (descartar `accuracy<0` ou ≥30).
