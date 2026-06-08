# ENVIRONMENT — Setup da máquina para desenvolver e testar o Athly Android

Guia para deixar sua máquina pronta para **buildar, rodar e testar** o `athly-android`. Feito para
macOS (o mesmo serve em Linux/Windows com ajustes de caminho).

## 1. Pré-requisitos

| Ferramenta | Versão | Como instalar |
|---|---|---|
| **JDK** | 17 (Temurin) | `brew install --cask temurin17` (ou via Android Studio) |
| **Android Studio** | Ladybug+ (2024.2+) | https://developer.android.com/studio |
| **Android SDK** | Platform **API 35**, Build-Tools 35, Platform-Tools | SDK Manager dentro do Android Studio |
| **Git** | qualquer | já instalado |

No Android Studio: **Settings → SDK Manager** → marque *Android 15 (API 35)*, *Android SDK Build-Tools*,
*Android SDK Command-line Tools*, *Android Emulator*, *Google Play services*.

Aponte o `JAVA_HOME` para o JDK 17 (ou use o "Embedded JDK" do Android Studio). Confirme: `java -version`.

## 2. Abrir o projeto

```bash
cd /Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-android
# Abra esta pasta no Android Studio (File → Open). Deixe o Gradle sync rodar.
```

> O prompt `00-foundation.md` cria o projeto Gradle aqui. Se a pasta ainda só tem `_planning/`,
> rode o prompt `00` primeiro.

## 3. `local.properties` (segredos — NÃO commitar)

Crie/edite `athly-android/local.properties`:

```properties
sdk.dir=/Users/alexandredafonsecajunior/Library/Android/sdk
# Google Maps (ver passo 5)
MAPS_API_KEY=COLE_SUA_KEY_AQUI
# Backend: produção por padrão; para backend local, use o IP da sua LAN (não localhost!)
DEV_API_URL=https://api.athlyproject.app
# Ex. backend local: DEV_API_URL=http://192.168.1.67:4000
```

O `build.gradle.kts` lê essas chaves e expõe via `BuildConfig.BASE_URL` e o `manifestPlaceholders`
do Maps (espelha o `DEV_API_URL`/`Config.xcconfig` do iOS).

## 4. Dispositivo de teste

- **Device físico (recomendado p/ GPS + Health Connect):** ative *Opções do desenvolvedor* → *Depuração USB*,
  conecte por USB, aceite a chave RSA. Android 14+ já vem com Health Connect nativo.
- **Emulador:** crie um AVD **Pixel 7/8, API 34 ou 35, imagem com Google Play**. (GPS é simulável; Health
  Connect funciona, mas em alguns AVDs antigos é preciso instalar o app **Health Connect** pela Play Store.)

## 5. Google Maps API key

1. https://console.cloud.google.com → crie um projeto.
2. **APIs & Services → Library →** habilite **Maps SDK for Android**.
3. **Credentials → Create credentials → API key**. (Opcional: restrinja por *Android apps* com o
   package `com.athly.runner` + SHA-1 do debug keystore: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`.)
4. Cole em `local.properties` como `MAPS_API_KEY`.

## 6. Health Connect

- **Android 14+:** já integrado ao sistema (Settings → Segurança e privacidade → Health Connect).
- **Android ≤13 / emulador:** instale o app **Health Connect (by Android)** da Play Store.
- O app pede permissões em runtime (ler exercícios/FC, escrever treino). Para popular dados de teste,
  registre uma corrida pelo próprio app, ou use o app **Health Connect** para inserir dados de exemplo.

## 7. Fonte SpaceGrotesk

Baixe a família em https://fonts.google.com/specimen/Space+Grotesk e coloque os `.ttf`
(Regular/Medium/SemiBold/Bold) em `app/src/main/res/font/` com nomes em snake_case
(`spacegrotesk_regular.ttf`, etc.). O `01-design-system.md` registra a `FontFamily`.

## 8. Buildar e rodar

```bash
# pela linha de comando
./gradlew assembleDebug          # compila
./gradlew installDebug           # instala no device/emulador conectado
# ou simplesmente Run ▶ no Android Studio (configuração 'app')
```

Logs: **Logcat** no Android Studio (filtre por `com.athly.runner`), ou `adb logcat`.

## 9. Testar GPS sem sair correndo

- **Emulador:** *Extended controls* (⋮) → **Location** → importe um **GPX** e dê *Play route* (equivale
  ao "Features → Location → City Run" do simulador iOS). Use para validar pace ao vivo, splits e o
  resumo da corrida.
- **Device físico:** teste real ao ar livre, ou use apps de *mock location* nas Opções do desenvolvedor.

## 10. Permissões a conceder ao testar

- **Localização:** "Permitir o tempo todo" (precisa de *background* para corrida com tela bloqueada).
- **Notificações:** Android 13+ pede `POST_NOTIFICATIONS` (corrida em andamento + lembretes).
- **Health Connect:** conceda leitura de exercício/FC e escrita de treino quando solicitado.

## 11. Release (mais tarde)

- Gerar keystore: `keytool -genkey -v -keystore athly-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias athly`.
- Configurar `signingConfigs` no `build.gradle.kts` lendo de `local.properties`/variáveis de ambiente.
- `./gradlew bundleRelease` → `.aab` para a Play Store.

## Checklist rápido

- [ ] JDK 17 + Android Studio + SDK API 35
- [ ] `local.properties` com `sdk.dir`, `MAPS_API_KEY`, `DEV_API_URL`
- [ ] Device físico (USB debug) ou AVD com Play
- [ ] Health Connect disponível e com permissões
- [ ] Fontes SpaceGrotesk em `res/font`
- [ ] `./gradlew installDebug` roda o app
