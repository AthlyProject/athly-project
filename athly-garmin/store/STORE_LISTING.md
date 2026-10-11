# Connect IQ Store listing: Athly

Copy for the upload form at [apps-developer.garmin.com](https://apps-developer.garmin.com/). The app
ships in English, Portuguese and German, so the description and the images that carry text come
in the three languages. Images are in `store/images/`; regenerate them with `node store/render.mjs`.

## Before you submit

- **Privacy policy is out of date.** `athly-frontend/src/config/legalContent.ts` still lists Garmin
  as a *planned* connection and promises to update the policy before enabling it (pt and en
  sections). Update it to cover the watch data listed under "Does your app collect user data?"
  before the listing goes public.
- **Screen images are renderings, not simulator captures.** They are drawn from the app's own
  layout code, strings and the simulator's font, but the workout list is Garmin's native menu and
  is only approximated. Replace `3-workouts.png` with a simulator capture if you want it exact.
- **Payment questions.** The watch app is free and has no purchases. If the form asks whether the
  app needs a paid service, answer according to how the Athly subscription gates training plans.

## Title

```
Athly
```

## Description

### English

```
Athly puts your planned running workouts on your watch as native workouts. Open the app and the next 7 days of your Athly training plan are downloaded to your watch, ready to run in the built-in workout player: warm-up, intervals with pace targets, repeats and cool-down.

HOW IT WORKS
1. Open Athly on your watch. It shows an 8-digit code.
2. In the Athly app on your iPhone, go to Settings > Garmin watch and enter the code.
3. Your workouts sync every time you open Athly on the watch. Pick one from the list to start it, or find it later under Training > Workouts.

FEATURES
• Up to 7 upcoming workouts, labelled by day
• Changed workouts are updated, and workouts removed from your plan are deleted from the watch
• Glance with your next workout
• Downloaded workouts stay available without your phone
• English, Portuguese and German

GOOD TO KNOW
• Requires an Athly account and the Athly app for iPhone: https://athlyproject.app
• Syncing needs your phone nearby with Garmin Connect running. There is no background sync: open Athly on the watch to sync.
• Workout memory on the watch is limited and shared with your own workouts. If it is full, delete old workouts on the watch.
• Choose Disconnect on the watch to unlink it and remove Athly's workouts.
```

### Português (Brasil)

```
A Athly coloca os treinos de corrida do seu plano no relógio como treinos nativos. Abra o app e os treinos dos próximos 7 dias do seu plano na Athly são baixados para o relógio, prontos para rodar no player de treino do próprio relógio: aquecimento, tiros com alvo de pace, repetições e volta à calma.

COMO FUNCIONA
1. Abra a Athly no relógio. Ela mostra um código de 8 dígitos.
2. No app Athly do iPhone, vá em Configurações > Relógio Garmin e digite o código.
3. Os treinos sincronizam sempre que você abre a Athly no relógio. Escolha um na lista para começar, ou encontre depois em Treino > Treinos.

RECURSOS
• Até 7 próximos treinos, identificados pelo dia
• Treinos alterados são atualizados, e os que saíram do plano são apagados do relógio
• Glance com o seu próximo treino
• Os treinos baixados continuam disponíveis sem o celular
• Português, inglês e alemão

BOM SABER
• Requer uma conta Athly e o app Athly para iPhone: https://athlyproject.app
• A sincronização precisa do celular por perto com o Garmin Connect aberto. Não há sincronização em segundo plano: abra a Athly no relógio para sincronizar.
• A memória de treinos do relógio é limitada e dividida com os seus próprios treinos. Se estiver cheia, apague treinos antigos no relógio.
• Escolha Desconectar no relógio para desvincular e remover os treinos da Athly.
```

### Deutsch

```
Athly bringt deine geplanten Lauftrainings als native Trainings auf deine Uhr. Öffne die App, und die Trainings der nächsten 7 Tage aus deinem Athly-Trainingsplan werden auf die Uhr geladen – bereit für den integrierten Trainingsplayer: Aufwärmen, Intervalle mit Pace-Zielen, Wiederholungen und Auslaufen.

SO FUNKTIONIERT ES
1. Öffne Athly auf der Uhr. Sie zeigt einen 8-stelligen Code.
2. Gehe in der Athly-App auf dem iPhone zu Einstellungen > Garmin-Uhr und gib den Code ein.
3. Deine Trainings werden bei jedem Öffnen von Athly auf der Uhr synchronisiert. Wähle eines aus der Liste, um es zu starten, oder finde es später unter Training > Trainings.

FUNKTIONEN
• Bis zu 7 anstehende Trainings, nach Tag beschriftet
• Geänderte Trainings werden aktualisiert, aus dem Plan entfernte Trainings von der Uhr gelöscht
• Glance mit deinem nächsten Training
• Geladene Trainings bleiben auch ohne Smartphone verfügbar
• Deutsch, Englisch und Portugiesisch

GUT ZU WISSEN
• Erfordert ein Athly-Konto und die Athly-App für iPhone: https://athlyproject.app
• Für die Synchronisierung muss dein Smartphone in der Nähe sein und Garmin Connect laufen. Es gibt keine Hintergrundsynchronisierung: Öffne Athly auf der Uhr, um zu synchronisieren.
• Der Trainingsspeicher der Uhr ist begrenzt und wird mit deinen eigenen Trainings geteilt. Ist er voll, lösche alte Trainings auf der Uhr.
• Wähle auf der Uhr „Trennen“, um die Verbindung aufzuheben und die Athly-Trainings zu entfernen.
```

## Hero image

1440 x 720 px, one per language because it carries the app name and a tagline.

| Language | File |
|---|---|
| English | `images/hero-en.png` |
| Português | `images/hero-pt.png` |
| Deutsch | `images/hero-de.png` |

The watch in the artwork is a generic drawing, not a Garmin device image.

## Category

**Running.** If the dropdown for device apps does not offer it, use **Health & Fitness**.

## Does your app collect user data?

**Yes.** Privacy policy URL: `https://athlyproject.app/privacy`

What the watch app sends to the Athly backend (`api.athlyproject.app`), linked to the Athly account
the watch is paired with:

| Data | When | Source |
|---|---|---|
| Watch model (part number), Connect IQ API level, app version | Requesting a pairing code | `Api.deviceInfo` |
| Watch unique identifier (when the watch exposes one) | Requesting a pairing code | `Api.deviceInfo` |
| Sync report: counts of workouts downloaded and removed, ids of synced workouts, failure codes, storage-full flag, app version | After each sync | `SyncManager.sendReport` |

The app does not read heart rate, GPS, activity history or any other sensor or health data: its
only permissions are `Communications` and `PersistedContent`.

## Does your app decode/encode any ANT+ profiles?

**No.** The app does not use `Toybox.Ant` or the `Ant` permission. It only makes HTTPS requests
through the phone and saves downloaded workout files.

## Cover image & icons

| Asset | Size | File |
|---|---|---|
| Cover image | 500 x 500 px | `images/cover.png` |
| Icon | 128 x 128 px | `images/icon.png` |

Both follow Garmin's icon rules: solid background that is neither black nor transparent
(`#16224F`), no text, more than 10 px of padding around the mark.

## Screen images

454 x 454 px (Forerunner 970 / 570 47mm screen), one set per language in
`images/screens/{en,pt,de}/`.

| File | Screen |
|---|---|
| `1-pairing.png` | Pairing code to type into the Athly app |
| `2-sync.png` | Downloading workouts |
| `3-workouts.png` | Upcoming workouts list |
