---
tags: [tipo/integracao, integracao/zepp, integracao/amazfit, contexto/produto]
status: draft
created: 2026-07-14
---

# Zepp/Amazfit — Treinos planejados

## Pergunta

Conseguimos importar os treinos planejados gerados no Athly para o Zepp/Amazfit Active 3 Premium como treinos executáveis no relógio?

## Resposta curta

Pela documentação pública atual, não há API oficial exposta para criar ou importar um treino planejado nativo no app Zepp ou no app Workout do relógio.

O Active 3 Premium é um dispositivo Zepp OS moderno: a documentação oficial lista o modelo com Zepp OS 5.0 e API_LEVEL 4.2. Ainda assim, as APIs públicas encontradas cobrem Mini Programs, exibição/leitura de dados de treino, Workout Extensions e transferência genérica de arquivos. Nenhuma delas documenta uma operação de escrita como "create planned workout", "import structured workout" ou equivalente.

Decisão de produto: não assumir integração nativa Athly -> Zepp sem parceria ou confirmação formal da Zepp. Para MVP, tratar como bloqueado por ausência de API pública e considerar apenas alternativas explícitas.

## Matriz de viabilidade

| Caminho | Resultado para o usuário | Viabilidade | Decisão |
| --- | --- | --- | --- |
| Importação nativa Zepp | Treino Athly aparece no Zepp/Workout como sessão planejada executável | Não encontrada em documentação pública | Bloqueado até Zepp confirmar API pública ou partner |
| Workout Extension | Plugin dentro do app Workout com UI/dados extras durante treino | A documentação descreve extensão de experiência, não criação/importação de treino | Não resolve importação planejada |
| Mini Program Athly | App próprio no relógio lê o treino Athly e guia blocos/intervalos | Tecnicamente plausível via Mini Program + arquivo/estado próprio | Possível protótipo, mas não vira treino nativo Zepp |
| TransferFile | Enviar arquivo JSON/asset ao relógio | API documentada para transferência genérica de arquivos | Útil apenas como transporte para Mini Program |
| GPX/rotas | Enviar rota para navegação | Serve para percurso, não para estrutura de treino | Fora do escopo de treino planejado |
| Apple Health/HealthKit | Registrar atividade concluída no iOS | HealthKit não agenda treino planejado no Zepp | Não resolve envio para relógio |
| Parceria Zepp/Runna/TrainingPeaks-like | Treino Athly entra no ecossistema Zepp por API não pública | Possível só se Zepp liberar integração partner | Melhor caminho para experiência nativa |

## Formato Athly a mapear

O Athly já tem uma fonte estruturada adequada para exportação: `WorkoutModel.segments`.

Campos relevantes:

| Athly | Uso no destino |
| --- | --- |
| `date`, `title`, `sportType` | Agenda/identificação do treino |
| `segments.schemaVersion`, `segments.sport` | Versão e modalidade |
| `Segment.kind` | `warmup`, `work`, `recovery`, `cooldown`, `rest`, `set` |
| `Segment.end.by/value` | Condição de término por distância, duração ou reps |
| `Segment.repetitions`, `children` | Séries de intervalos repetidos |
| `Segment.target` | Pace, zona de FC, RPE, potência/cadência quando existir |

Se uma API partner existir, este é o contrato mínimo a transformar. Se não existir, o mesmo contrato pode alimentar um Mini Program Athly separado.

## Opção de protótipo sem API partner

Criar um Mini Program Athly no Zepp OS que:

- recebe um JSON de treino planejado do Athly;
- renderiza lista de blocos, bloco atual e próximo bloco;
- expande `set` em repetições;
- mostra alvos de distância/duração/pace/RPE;
- emite feedback visual e, se suportado pelo runtime, vibração/som.

Limitações esperadas:

- não deve aparecer como treino planejado nativo no Zepp;
- não deve popular automaticamente histórico, carga de treino ou Zepp Coach;
- depende de aprovação/distribuição no ecossistema Zepp;
- precisa validar no Active 3 Premium se Mini Programs e permissões necessárias estão disponíveis no app Zepp do usuário.

## Perguntas para a Zepp

Antes de investir em integração nativa, pedir confirmação objetiva:

1. Existe API pública ou partner para criar treinos planejados no Zepp/Workout app?
2. O Active 3 Premium aceita importação de structured workouts externos?
3. Quais formatos são suportados: JSON proprietário, FIT workout, TCX, GPX route, outro?
4. A integração é por conta Zepp/cloud, app mobile companion, Bluetooth ou arquivo?
5. Treinos importados entram em Zepp Coach, carga de treino, calendário e histórico?
6. Quais requisitos de aprovação, marca, privacidade e distribuição existem para parceiros?

## Fontes oficiais consultadas

- Zepp OS introdução: https://docs.zepp.com/docs/intro/
- Lista oficial de dispositivos Zepp OS: https://docs.zepp.com/docs/reference/related-resources/device-list/
- Workout Extension: https://docs.zepp.com/docs/guides/workout-extension/intro/
- Widget `SPORT_DATA`: https://docs.zepp.com/docs/reference/device-app-api/newAPI/ui/widget/SPORT_DATA/
- `getSportData`: https://docs.zepp.com/docs/reference/device-app-api/newAPI/app-access/getSportData/
- `TransferFile`: https://docs.zepp.com/docs/reference/device-app-api/newAPI/transfer-file/TransferFile/

## Fontes secundárias úteis

- Runna/Amazfit como sinal de integração partner, não API pública: https://www.techradar.com/health-fitness/smartwatches/amazfit-smartwatches-just-got-two-new-features-that-make-them-even-better-value
- Active 3 Premium com Zepp Coach/planos adaptativos, não importação Athly: https://www.t3.com/active/fitness-trackers/amazfit-active-3-premium-launch-0326
