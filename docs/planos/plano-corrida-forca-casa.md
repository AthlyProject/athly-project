# Plano: Corrida + Forca em Casa no Athly

## Resumo

O Athly deve evoluir de um planner focado apenas em corrida para um treinador unico capaz de prescrever corrida + forca/musculacao/treino em casa.

O objetivo especifico continua sendo definido em texto livre na criacao do Training Plan. Exemplos:

- "Quero correr 5km abaixo de 25min e ganhar massa treinando em casa"
- "Quero melhorar minha corrida e fazer musculacao 3x por semana"
- "Quero estetica, hipertrofia e manter corrida leve"

Os sliders nao definem o objetivo. Eles definem a prioridade/alocacao por modalidade.

## Decisoes de Produto

- O usuario escreve o objetivo em texto livre.
- A tela tera sliders de modalidade, inicialmente:
  - Corrida
  - Forca/Musculacao/Treino em casa
- O usuario podera escolher dias disponiveis por modalidade.
- O usuario podera escolher frequencia semanal por modalidade.
- Equipamentos serao selecionados a partir de uma lista pre-cadastrada.
- Se o usuario nao tiver equipamentos cadastrados, o fallback sera peso corporal + cadeira/sofa/apoio domestico.
- V1 sera prescricao simples, sem tracker completo de series.

## Backend

Adicionar `trainingConfig` ao `TrainingPlan`, contendo:

- `sportWeights`
  - Exemplo: `{ "running": 70, "strength": 30 }`
- `sportAvailability`
  - Exemplo: `{ "running": ["monday", "wednesday"], "strength": ["tuesday", "friday"] }`
- `weeklyFrequency`
  - Exemplo: `{ "running": 3, "strength": 2 }`
- `strengthEquipmentIds`
  - IDs dos equipamentos escolhidos pelo usuario
- `parsedObjective`
  - Saida estruturada do parser do objetivo livre

Atualizar o parser de objetivo para deixar de assumir que o Athly e exclusivamente running.

O parser deve extrair:

- modalidades envolvidas
- objetivo principal por modalidade
- metas mensuraveis
- conflitos potenciais
- prioridade implicita no texto, quando houver

## Planner IA

Atualizar o planner semanal para aceitar `sportType: "strength"`.

O prompt deve receber:

- texto livre original do objetivo
- `parsedObjective`
- pesos dos sliders
- dias disponiveis por modalidade
- frequencia desejada por modalidade
- equipamentos disponiveis
- fallback de peso corporal quando nao houver equipamentos

Regras importantes:

- Forca nao conta como volume de corrida.
- Treino pesado de pernas nao deve cair na vespera de treino-chave de corrida, exceto se a prioridade de forca for maior.
- Para peso corporal, progredir por reps, series, tempo sob tensao, unilateralidade, amplitude ou descanso.
- Nao usar `loadKg` se nao houver equipamento de carga.
- Prescricao de forca deve usar:
  - exercicio
  - series
  - reps
  - descanso
  - tempo
  - RPE

## iOS

Na criacao do plano:

- Campo de objetivo livre.
- Slider de Corrida.
- Slider de Forca/Musculacao/Treino em casa.
- Selecao de dias por modalidade.
- Frequencia semanal por modalidade.

Na area de perfil/configuracao:

- Tela para selecionar equipamentos disponiveis.

Na tela de treino:

- Reusar a tela de detalhe atual.
- Melhorar renderizacao de treino de forca para mostrar:
  - exercicio
  - series
  - reps
  - descanso
  - tempo
  - RPE

V1 nao tera:

- timer dedicado de descanso
- execucao ao vivo de series
- historico detalhado de carga/reps por exercicio
- integracao HealthKit para forca

## Testes

Backend:

- Criar/editar/buscar TrainingPlan com `trainingConfig`.
- Parser com objetivos mistos.
- Planner gerando corrida + forca.
- Forca nao entrando no volume de corrida.
- Fallback sem equipamentos.
- Schema Gemini aceitando `strength`.
- Gate estrutural de corrida nao aplicado a forca.

iOS:

- Encode/decode de `trainingConfig`.
- UI dos sliders.
- UI de disponibilidade por modalidade.
- UI de selecao de equipamentos.
- Render de treino `strength`.
- Concluir/pular treino de forca.

## Assumptions

- V1 suporta `running` + `strength`.
- O objetivo especifico vem do texto livre.
- Sliders representam prioridade entre modalidades.
- Equipamentos vem do catalogo existente.
- Usuarios antigos sem `trainingConfig` continuam no fluxo atual de corrida.
