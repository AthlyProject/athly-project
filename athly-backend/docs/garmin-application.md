# Garmin Connect Developer Program — Material de Solicitação

Material para aplicar à **Garmin Activity API** (Garmin Connect Developer Program). Escopo
**multiesporte**: corrida no lançamento; ciclismo e natação no roadmap (vêm pela mesma Activity API).

> Pré-requisito: a **política de privacidade** (seção 4) precisa estar pública **antes** de submeter —
> a Garmin avalia, e ela também satisfaz a obrigação de consentimento de uso de dados com IA.

## 1. Dados da solicitante (campos do Access Request Form)

| Campo | Valor |
|---|---|
| Legal entity | **AFJ DESENVOLVIMENTO DE SISTEMAS LTDA** (CNPJ) |
| Product / app | **Athly** — AI endurance coach |
| API solicitada | **Activity API** (Activity Summaries + **Activity Details** + **Activity Files / FIT**) |
| Esportes | Running (lançamento) → **Cycling + Swimming (roadmap)** |
| Região | Worldwide (ou Brazil, conforme operação) |
| Website + Privacy Policy | _URLs públicas_ |
| **Não** solicitar | Health API (dados all-day de bem-estar) — minimização de dados: só precisamos de atividades |

## 2. Descrição do caso de uso (paste-ready, EN)

> **Athly** is an AI-assisted endurance coaching app. It generates personalized weekly training plans
> and objective post-activity analysis for each athlete. We are requesting the **Activity API** to
> import our users' completed activities — **running at launch, with cycling and swimming on our
> near-term roadmap** — including GPS, **laps/splits**, heart-rate series, and sport-specific metrics
> (via Activity Details and Activity Files / FIT).
>
> **How the data is used:** For each imported activity we compute objective execution metrics
> server-side — per-lap/interval pace, interval (rep/recovery) adherence vs. the prescribed workout,
> heart-rate recovery between efforts, pacing strategy, and training load. These structured metrics are
> then used to generate the athlete's next training block and individualized feedback. We need
> lap-level data specifically because interval and split analysis is impossible from summary totals
> alone.
>
> **Data flow & consent:** Activities are ingested server-side via Garmin's ping/push notifications.
> Each user authorizes the connection individually through **OAuth 2.0 (PKCE)**, after giving
> **explicit, informed consent** to importing their Garmin data and to it being processed by AI to
> produce coaching. Users can **disconnect at any time**, which revokes the tokens and stops all
> processing. We handle data in accordance with the Garmin Connect Developer Program Agreement,
> Garmin's brand guidelines, and applicable privacy law (LGPD/GDPR).
>
> **Why a direct Garmin integration:** Apple Health does not carry Garmin GPS routes or laps, so
> granular per-interval analysis is only possible through the Activity API.

## 3. Detalhes técnicos (ter à mão)

- **Redirect URI** do OAuth2 PKCE — ex.: `https://api.athlyproject.app/integrations/garmin/callback`
- **Webhook URL** pública (ping/push) — ex.: `https://api.athlyproject.app/integrations/garmin/webhook`
- Volume estimado de usuários (estimativa honesta — afeta rate limits).
- Confirmar que quer **Activity Files (FIT)** além de Activity Details (é o FIT que traz os laps estruturados).

## 4. Checklist da Política de Privacidade (pública antes de aplicar)

- [ ] Declara que **coleta dados de atividades do Garmin Connect** (GPS/rota, FC, laps/splits, distância, tempo, métricas por esporte).
- [ ] **Finalidade**: gerar análise e planos de treino personalizados.
- [ ] Que os dados são **processados por IA/LLM**, nomeando o provedor/sub-processador (ex.: Google Gemini).
- [ ] **Consentimento explícito** antes de conectar/processar + **como revogar** (desconectar) e que isso **apaga tokens e cessa o processamento**.
- [ ] **Retenção e exclusão** (excluir conta purga dados + tokens).
- [ ] Que **não compartilham os dados de um usuário com terceiros/outros usuários** sem consentimento.
- [ ] **Direitos do titular** (acesso, exclusão) sob LGPD/GDPR + **medidas de segurança**.
- [ ] Conformidade com o **Garmin Connect Developer Program Agreement** e **brand guidelines**.

## 5. Para a call de integração (pós-aprovação)

- Confirmar **escopo da Activity API** e os **tipos de atividade** liberados (running + cycling + swimming).
- **OAuth2 PKCE**: redirect URIs aceitos, lifetime do token (~3 meses) e fluxo de refresh.
- **Ping vs Push** e setup do **backfill** (blocos de 90 dias).
- **Pedir por escrito** os requisitos exatos de **consentimento de uso de dados com IA**.

## Fontes

- Garmin Activity API: https://developer.garmin.com/gc-developer-program/activity-api/
- Access Request Form: https://www.garmin.com/en-US/forms/GarminConnectDeveloperAccess/
- OAuth2 PKCE spec: https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf
- Developer Program Agreement: https://www8.garmin.com/en-US/GARMINCONNECTDEVELOPERPROGRAMAGREEMENT/GARMINCONNECTDEVELOPERPROGRAMAGREEMENT_EN.pdf
