# 00 — Foundation (scaffold do projeto Android)

## 1. Objetivo
Criar o projeto Gradle do `athly-android` com Compose + Hilt + Navigation e as convenções que **todos**
os prompts seguintes vão seguir. Mirror do `athly-ios` (que usa xcodegen `project.yml`).

## 2. Stack & convenções
Ver `_planning/README.md` (stack padrão + layout de pacote). Padronize tudo aqui.
**Versões travadas** (decisão: AGP 8.x LTS): AGP **8.13** · Kotlin **2.2.20** · **KSP** (sem kapt) ·
Hilt **2.57** · Compose BOM **2026.05** · Gradle **8.14** · compileSdk/target **36** · minSdk **26** · JDK **17**.
Definidas em `gradle/libs.versions.toml`.

## 3. Referência iOS
- Config/targets: `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/project.yml`
- Build settings/URL: `/Users/.../athly-ios/Config/Config.xcconfig` (prod `https://api.athlyproject.app`; override `DEV_API_URL`)
- `Info.plist` (permissões, dark mode forçado, portrait, fontes SpaceGrotesk, background `location`)
- App entry: `/Users/.../athly-ios/AthlyRunner/AthlyRunnerApp.swift` (injeta singletons), `RootView.swift`

## 4. Alvo Android (criar)
Projeto **single-module `app`** (suficiente; modularizar é fora de escopo).
- `settings.gradle.kts`, `build.gradle.kts` (root) com **version catalog** `gradle/libs.versions.toml`.
- `app/build.gradle.kts`:
  - `namespace`/`applicationId = "com.athly.runner"`, `minSdk 26`, `compileSdk 36`, `targetSdk 36`, JDK 17.
  - Plugins: `com.android.application`, `org.jetbrains.kotlin.android`, `org.jetbrains.kotlin.plugin.compose`,
    **KSP** (`com.google.devtools.ksp`, sem kapt), `com.google.dagger.hilt.android`,
    `org.jetbrains.kotlin.plugin.serialization`, `kotlin-parcelize`.
  - Compose habilitado (Compose BOM), `buildFeatures { compose = true; buildConfig = true }`.
  - Ler `local.properties`: expor `BuildConfig.BASE_URL` (de `DEV_API_URL`, default `https://api.athlyproject.app`)
    e `manifestPlaceholders["MAPS_API_KEY"]`.
  - `debug` com `usesCleartextTraffic` permitido p/ backend local (via `networkSecurityConfig` ou flag de debug).
- Dependências base no catalog: Compose (BOM, material3, ui, navigation-compose, lifecycle-viewmodel-compose,
  activity-compose), Hilt (`hilt-android`, `hilt-compiler`, `hilt-navigation-compose`), Coroutines,
  Retrofit + OkHttp(+logging) + `retrofit2-kotlinx-serialization-converter` + kotlinx-serialization-json,
  DataStore-preferences, security-crypto (EncryptedSharedPreferences), Room (runtime/ktx/compiler),
  play-services-location, `androidx.health.connect:connect-client`, maps-compose + play-services-maps,
  accompanist-permissions (ou API nativa), coil-compose, lifecycle-runtime-compose.
- `AndroidManifest.xml` base: `<application android:name=".AthlyApp" android:theme="@style/Theme.Athly">`,
  `MainActivity` (`android:screenOrientation="portrait"`), `<meta-data com.google.android.geo.API_KEY = ${MAPS_API_KEY}>`,
  permissões declaradas (mas pedidas em runtime nos prompts de cada feature):
  `INTERNET`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`, `ACTIVITY_RECOGNITION`,
  `WAKE_LOCK`, e as do Health Connect (declaração de permissões via `health-permissions` data + activity alias).
- Código base:
  - `AthlyApp.kt` (`@HiltAndroidApp`).
  - `MainActivity.kt` (`@AndroidEntryPoint`, `setContent { AthlyTheme { AthlyNavHost() } }`).
  - `core/navigation/AthlyNavHost.kt` (stub com NavController; rotas reais entram no `05`).
  - `core/di/` (módulos Hilt vazios prontos para os próximos prompts).
  - `core/common/` (`Result` wrapper, formatters de pace/distância/duração — espelhar os `formatted*` do iOS).
- Tema dark forçado (`isSystemInDarkTheme` ignorado — sempre dark), portrait only.

## 5. Contrato de dados
N/A (só `BuildConfig.BASE_URL`). Endpoints/DTOs entram no `02`.

## 6. Escopo
**In:** projeto compila e roda mostrando uma tela placeholder ("Athly") com o tema dark.
**Fora:** qualquer feature/tela real (vêm nos próximos prompts); modularização multi-módulo.

## 7. Dependências
Nenhuma (primeiro prompt). Requer `ENVIRONMENT.md` feito (SDK, `local.properties`).

## 8. Critérios de aceite
- `./gradlew assembleDebug` compila sem erro.
- `./gradlew installDebug` instala e abre um placeholder com fundo `#0a0a10`.
- `BuildConfig.BASE_URL` resolve do `local.properties` (logar uma vez no boot para conferir).
- Hilt funciona (`AthlyApp` com `@HiltAndroidApp`, `MainActivity` com `@AndroidEntryPoint`).

## 9. Pitfalls
- Versões do Compose Compiler ↔ Kotlin: use o Compose BOM + plugin `compose-compiler` (Kotlin 2.0+).
- `ACCESS_BACKGROUND_LOCATION` e `FOREGROUND_SERVICE_LOCATION` exigem texto/justificativa na Play Store —
  declarar agora, pedir em runtime depois.
- Não commitar `local.properties` (já no `.gitignore` do template Android).
- Maps key ausente → mapa cinza; deixe claro no README do app que a key é obrigatória.
