# Athly para Garmin (Connect IQ)

App de relógio que coloca os treinos planejados da Athly na lista **Treino › Treinos** do Garmin,
como treinos nativos: o player de treino da própria Garmin roda aquecimento, tiros com alvo de
pace, repetições e volta à calma.

> Por que um app Connect IQ e não a Training API da Garmin (calendário do Garmin Connect)? A Garmin
> pausou novos acessos ao Connect Developer Program na primavera de 2026, sem data para reabrir.

```
Relógio (este app) ──GET /connect-iq/manifest──────────► backend ── treinos dos próximos 7 dias
                   ──GET /connect-iq/workouts/:id/fit──►         ── FIT gerado de workouts.segments
                   ◄── PersistedContent grava o treino na lista nativa do relógio
App iOS ──POST /connect-iq/pairings/claim {código}──► backend   (pareamento por código de 8 dígitos)
```

- **Pareamento**: na primeira abertura o relógio mostra um código; o atleta digita em
  Athly › Configurações › Relógio Garmin. O relógio recebe um token próprio (não é o JWT do app).
- **Sincronização**: sempre que o app abre no relógio. Treinos novos ou alterados são baixados,
  os que saíram do plano são apagados. Não há sincronização em segundo plano: a Garmin não deixa
  baixar treino FIT em background.
- **Limites**: no máximo 7 treinos do app no relógio (a memória de treinos é pequena e dividida
  com os treinos do próprio atleta). No iPhone, o Garmin Connect precisa estar rodando.
- Corridas feitas com esses treinos voltam para a Athly pelo fluxo atual (Garmin Connect → Apple
  Health → detecção de corrida no app).

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `manifest.xml` | App `watch-app`, API mínima 3.1.0, permissões `Communications` + `PersistedContent`, relógios suportados |
| `source/` | `SyncManager` (sincronização), `SyncPlanner` (diff puro), `PairingController`, telas, glance |
| `test/` | Testes unitários Monkey C (`(:test)`) |
| `resources*/` | Textos em inglês (padrão), português (`resources-por`) e alemão (`resources-deu`) |
| `spike/` | Phase 0: fixtures FIT, servidor de teste e app de spike para medir os relógios reais |

Backend: `athly-backend/src/modules/connect-iq/`. App iOS: `athly-ios/AthlyRunner/Views/Profile/GarminConnectView.swift`.

## Pré-requisitos

1. [Connect IQ SDK Manager](https://developer.garmin.com/connect-iq/sdk/) (macOS). Instale o
   **SDK 9.2.0** (FR570/FR970 são API 6.0) e os dispositivos que vai testar (`fr165`, `fr57042mm`,
   `fr57047mm`, `fr970`, ...). O download dos dispositivos pede login Garmin.
   Os IDs têm o tamanho da caixa: o Forerunner 570 é `fr57042mm` ou `fr57047mm` (não existe `fr570`).
2. VS Code com a extensão **Monkey C** (Garmin) e um JDK.
3. Coloque o `bin` do SDK no PATH (no `~/.zshrc`; acompanha o SDK escolhido no SDK Manager):

   ```zsh
   export PATH="$(cat "$HOME/Library/Application Support/Garmin/ConnectIQ/current-sdk.cfg")bin:$PATH"
   ```

O código compila no nível de checagem de tipos mais rígido: use `-l 3 -w` ao compilar para não
deixar regredir.

### Chave do desenvolvedor (uma vez)

Todas as versões publicadas na loja precisam ser assinadas com a **mesma** chave; perder a chave
obriga a criar outro app na loja. Gere fora do repositório e guarde um backup (gerenciador de senhas):

```bash
mkdir -p ~/.garmin
openssl genrsa -out ~/.garmin/athly_ciq.pem 4096
openssl pkcs8 -topk8 -inform PEM -outform DER -in ~/.garmin/athly_ciq.pem -out ~/.garmin/athly_ciq.der -nocrypt
```

`*.der` e `*.pem` estão no `.gitignore`.

## Rodar no simulador

1. Suba o backend local (`cd athly-backend && npm run dev`, porta 4000). Builds de debug usam
   `http://localhost:4000` (`source/Config.mc`).
2. Compile e rode:

```bash
cd athly-garmin
monkeyc -f monkey.jungle -d fr165 -o bin/athly.prg -y ~/.garmin/athly_ciq.der
connectiq &                       # abre o simulador
monkeydo bin/athly.prg fr165
```

3. O relógio mostra o código; confirme com o app iOS (ou com
   `curl -X POST localhost:4000/connect-iq/pairings/claim -H "Authorization: Bearer <JWT>" -H 'Content-Type: application/json' -d '{"code":"12345678"}'`).

No simulador, **Settings › Use Device HTTPS Requirements** precisa ficar desligado para `http://localhost`.
Ligue quando testar contra uma URL HTTPS: é assim que o relógio de verdade se comporta.

## Testes unitários

```bash
monkeyc -f monkey.jungle -d fr165 -o bin/test.prg -y ~/.garmin/athly_ciq.der --unit-test
connectiq &
monkeydo bin/test.prg fr165 -t
```

Cobrem `DateFmt`, `SyncPlanner`, `ErrorMap` e a leitura do envelope de erro (`Api.status`).

## Rodar no relógio (sideload)

O relógio faz as requisições **pelo celular** e exige HTTPS com certificado válido, então
`localhost` não serve. Use produção ou um túnel para o backend local:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:4000      # imprime https://<algo>.trycloudflare.com
```

Troque a URL de debug em `source/Config.mc`, compile para o modelo do relógio e copie o `.prg`
para `GARMIN/APPS` (relógios usam MTP: no Mac, use o [OpenMTP](https://openmtp.ganeshrvel.com/)):

```bash
monkeyc -f monkey.jungle -d fr970 -o bin/athly-fr970.prg -y ~/.garmin/athly_ciq.der
```

## Phase 0 — spike nos relógios reais (antes de publicar)

Mede o que a Garmin não documenta, com o encoder FIT real do backend.

1. Gere as fixtures (precisa de `npm run build` no backend):
   `node athly-garmin/spike/make-fixtures.mjs`
2. Suba o servidor e o túnel:
   `node athly-garmin/spike/server.mjs` e `cloudflared tunnel --url http://localhost:8787`
3. Ponha a URL do túnel em `spike/watch/source/SpikeApp.mc` (`SPIKE_BASE`), compile e instale:
   `cd spike/watch && monkeyc -f monkey.jungle -d fr970 -o bin/spike.prg -y ~/.garmin/athly_ciq.der`
4. No relógio, com o Garmin Connect do iPhone aberto, depois em segundo plano e depois fechado:
   baixe cada fixture com cada Content-Type, use "Iniciar ultimo", confira em Treino › Treinos,
   rode um treino de tiros curto e use "Encher ate o limite".

Anote aqui e ajuste as constantes:

| Pergunta | FR165 | FR570 | FR970 | Ajusta |
|---|---|---|---|---|
| Content-Type aceito (`vnd` / `fit` / `octet`) | | | | `FIT_CONTENT_TYPE` (backend `fit.constants.ts`) |
| Treino aparece em Treino › Treinos e roda (app e menu nativo)? | | | | **go / no-go** |
| `intervals-recovery` funciona? (senão `intervals-rest`) | | | | `RECOVERY_INTENSITY` |
| Repetição conta o total de tiros? `nested-repeat` funciona? | | | | mapper (`workout-fit-plan.ts`) |
| Tamanho visível de nome, passo e notas; acentos | | | | `MAX_*_LENGTH`, sanitizer |
| Limite de treinos e como aparece (iterator nulo, 0, -1000) | | | | `MAX_MANIFEST_WORKOUTS`, mensagens |
| JSON 401 chega como 401, 0 ou -300? | | | | envelope de erro (`CiqEnvelopeFilter`) |
| `protocol-20` / `protocol-02` aceitos? | | | | `FIT_PROTOCOL_VERSION` |
| Comportamento com Garmin Connect em segundo plano / fechado | | | | textos de erro |

## Publicar na Connect IQ Store

1. Pacote: `monkeyc -f monkey.jungle -e -r -o bin/athly.iq -y ~/.garmin/athly_ciq.der`
   (`-r` = release: usa `https://api.athlyproject.app`).
2. Envie como **beta** em [apps-developer.garmin.com](https://apps-developer.garmin.com/) e instale
   pelo app Connect IQ Store no iPhone de teste (testa assinatura e instalação real).
3. Antes do envio público: política de privacidade cobrindo os dados do relógio (modelo, versão do
   app, relatórios de sincronização), descrição e capturas do simulador em pt/en/de. A revisão
   costuma levar 1–2 dias úteis.
4. Depois da aprovação, no iOS: `FeatureFlags.garminWatchSync = true` e `garminStoreURL`.

## Códigos de erro no relógio

| Código | Significado | O que o relógio faz |
|---|---|---|
| -104, -2, -3, -4, -5, -101, -103 | Sem conexão com o celular | "Abra o Garmin Connect no celular"; a lista salva continua acessível |
| -300 | Tempo esgotado (ou o watchdog de 30 s) | Pula para o próximo treino |
| -1000, -2000 | Sem espaço para treinos (-2000 = 200 sem treino no iterator) | Para a fila e pede para apagar treinos antigos |
| -1001 | HTTPS inválido | Erro de configuração do servidor |
| -1002 | Content-Type do FIT recusado | Rever `FIT_CONTENT_TYPE` |
| -2001 | Relógio sem download FIT (`SymbolNotAllowedException`) | "Este relógio não baixa treinos" |
| 401 (envelope) | Relógio desconectado no app | Apaga token e treinos, volta ao pareamento |

Os relatórios de cada sincronização chegam ao backend em `POST /connect-iq/sync-reports` e saem no
log como `event: "ciq_sync_report"` (com `partNumber`), para acompanhar falhas por modelo no Grafana.
