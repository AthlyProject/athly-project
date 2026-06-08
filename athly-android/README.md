# Athly Android

Port Kotlin/Compose do `athly-ios` (AthlyRunner). Construído fatia a fatia pelos prompts em
[`_planning/`](_planning/README.md). Esta é a fatia **00 (foundation)**: scaffold que compila e abre uma
tela placeholder com o tema dark.

## Stack
Jetpack Compose · MVVM + Hilt · Coroutines/Flow · Retrofit + OkHttp + kotlinx.serialization · Google Maps
(Maps Compose) · Health Connect. **AGP 8.13 / Kotlin 2.2 / KSP**, `minSdk 26`, `compileSdk/target 36`, JDK 17.

## Setup
Ver [`_planning/ENVIRONMENT.md`](_planning/ENVIRONMENT.md). Resumo:
1. JDK 17 + Android Studio + SDK API 36.
2. `cp local.properties.example local.properties` e preencha `sdk.dir`, `MAPS_API_KEY`, (opcional) `DEV_API_URL`.
3. **Fontes SpaceGrotesk (obrigatório p/ compilar):** baixe a família em
   <https://fonts.google.com/specimen/Space+Grotesk> e salve os 4 pesos em `app/src/main/res/font/` como
   `spacegrotesk_regular.ttf`, `spacegrotesk_medium.ttf`, `spacegrotesk_semibold.ttf`, `spacegrotesk_bold.ttf`.
   (Sem eles, `R.font.spacegrotesk_*` não resolve e o build falha — design system usa essa fonte.)
4. Abra a pasta no Android Studio e deixe o Gradle sync rodar.

## Gradle wrapper
Este scaffold inclui `gradle/wrapper/gradle-wrapper.properties` (Gradle 8.14) mas **não** o binário
`gradle-wrapper.jar`/`gradlew` (são gerados localmente). Gere uma vez:
- **Android Studio:** abra o projeto → o sync gera o wrapper automaticamente; ou
- **CLI (se tiver Gradle 8.x):** `gradle wrapper --gradle-version 8.14`
> Se a versão do Gradle não bater com o AGP, ajuste `distributionUrl` (AGP 8.13 exige Gradle ≥ 8.13).

## Build & run
```bash
./gradlew assembleDebug      # compila
./gradlew installDebug       # instala no device/emulador
```
`MAPS_API_KEY` pode ficar vazio para o build passar (o mapa fica cinza). `BuildConfig.BASE_URL` é logado
uma vez no boot (`Logcat`, tag `Athly`).

## Estrutura
`app/src/main/java/com/athly/runner/` — `AthlyApp`, `MainActivity`, `core/{navigation,designsystem,di,common}`.
Features (`feature/*`), networking real (`02`), tema completo (`01`) etc. entram nos próximos prompts.
