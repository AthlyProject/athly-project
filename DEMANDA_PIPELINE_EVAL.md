# Demanda: Pipeline de Eval para o AI Planner (datasets + LLM-as-judge)

> **Público deste documento:** um agente de planejamento/implementação. Ele descreve a construção
> de um pipeline de avaliação automatizada para as funcionalidades de LLM do backend do Athly,
> com contexto do código atual, arquitetura proposta, exemplos e critérios de aceite. O agente
> deve produzir um plano de implementação antes de codar.

---

## Contexto do projeto (estado atual)

Backend NestJS em `athly-backend/`. Toda a IA vive em `src/modules/ai-planner/`:

- `gemini.service.ts` (~720 linhas) — chamadas ao Gemini com structured output (schemas de
  segmentos de treino), loop de retry `MAX_STRUCTURE_ATTEMPTS` com detecção de dias degenerados,
  tracking de custo/tokens (`AiPlannerUsage`, incluindo `estimatedCostUsd` e `attempts`).
- `ai-planner.service.ts` (~1.100 linhas) — orquestra o planejamento semanal.
- `prompts/planner-prompt.ts` — `buildPlannerPrompt` (gera a semana de treinos) e
  `buildAssessmentPrompt`; recebe `UserProfileContext`, `LongitudinalWeek[]`,
  `DeterministicPlannerContext`, `PlannerGuardrails`.
- `prompts/goal-parser-prompt.ts` — `buildGoalParserPrompt(goalText)` → `ParsedGoal`
  (`isRunningRelated`, `targetDistance`, `targetTime`, `eventDate`, `eventName`,
  `experienceLevel`, `summary`, `rejectionReason`).
- `periodization.ts` — periodização determinística (`PlannedWeek`).
- `goal-feasibility.ts` — análise de viabilidade da meta.
- `workout-execution-analyzer.service.ts` — análise das sessões executadas.
- Validadores determinísticos já existentes: `validateSegmentTree`,
  `isStructurallyCompleteRun` (em `src/modules/workouts/utils/validate-segments.ts`),
  além dos guardrails (`PlannerGuardrails`: `weeklyVolumeMaxKm`, `availableDays`,
  `goalAttemptAllowed`, etc.).
- Testes unitários existem (specs dos serviços), mas **não existe nenhuma avaliação da
  QUALIDADE do output do LLM**.

**Evidência do problema:** o git log recente tem 4 commits seguidos `fix: prompt` /
`fix: prompt model`. Cada um foi validado na mão, sem baseline, sem número. Não há como saber
se uma mudança de prompt melhora 10 casos e quebra 20.

**Objetivo geral:** toda mudança em prompt, modelo ou lógica do planner deve poder ser julgada
por um comando (`npm run eval`) que devolve notas comparáveis entre rodadas.

---

## Visão geral do pipeline

```
eval/
  datasets/
    goal-parser-v1.jsonl        # Demanda 1
    planner-profiles-v1.json    # Demanda 2
  judges/
    plan-quality-judge.ts       # prompt + parsing do LLM-as-judge
  runners/
    run-goal-parser-eval.ts
    run-planner-eval.ts
  reports/                      # saída JSON + markdown por rodada (gitignored ou versionado — decidir)
```

Três camadas de avaliação, da mais barata para a mais cara:

- **L1 — Checagens de código (grátis, determinísticas):** reaproveitar `validateSegmentTree`,
  `isStructurallyCompleteRun` e asserts sobre guardrails. Qualquer plano que falhe aqui nem
  chega ao judge.
- **L2 — Métricas determinísticas:** números calculados do plano (volume total, progressão
  semanal, distribuição de intensidade) comparados a faixas esperadas por perfil.
- **L3 — LLM-as-judge:** um segundo LLM avalia critérios qualitativos que código não pega
  ("essa semana faz sentido para esse atleta?").

---

## Demanda 1 — Eval do goal parser (começar por aqui: menor esforço, fecha o conceito)

### Por quê primeiro

`ParsedGoal` é estrutura fechada → comparação exata ou quase-exata, **sem judge**. Uma tarde de
trabalho e o mecanismo inteiro (dataset → runner → report → baseline) fica de pé.

### Dataset (`eval/datasets/goal-parser-v1.jsonl`, 50–100 casos)

Cobrir as dimensões: metas claras, metas vagas, datas relativas, fora de escopo, erro de
digitação, mistura de esportes, pegadinhas. Exemplos:

```jsonl
{"input": "quero correr 10k em 50 minutos até dezembro", "expected": {"isRunningRelated": true, "targetDistance": "10k", "targetTime": "50:00", "experienceLevel": null}}
{"input": "terminar a maratona de floripa em agosto", "expected": {"isRunningRelated": true, "targetDistance": "42k", "eventName": "Maratona de Florianópolis"}}
{"input": "quero ficar grande na academia", "expected": {"isRunningRelated": false, "rejectionReason": "*"}}
{"input": "correr sem parar por 30 minutos, sou iniciante", "expected": {"isRunningRelated": true, "targetTime": "30:00", "experienceLevel": "beginner"}}
{"input": "emagrecer 5kg correndo", "expected": {"isRunningRelated": true}}
{"input": "nadar 1500m e depois quem sabe um triathlon", "expected": {"isRunningRelated": false}}
{"input": "melhorar meu pace dos 5 km, hj faço 6:30", "expected": {"isRunningRelated": true, "targetDistance": "5k"}}
{"input": "asdfgh", "expected": {"isRunningRelated": false}}
```

Regras de comparação (definir no runner, campo a campo):

- Campos categóricos/booleanos: igualdade exata.
- `targetDistance`/`targetTime`: normalizar antes de comparar ("10k" == "10 km"; "50:00" == "50 minutos").
- `expected.campo = "*"`: só exige não-nulo.
- Campos ausentes no `expected`: não avaliados (o caso testa só o que declara).
- `summary`: nunca comparado por igualdade (texto livre) — no máximo checagem de não-vazio.

### Runner (`npm run eval:goal-parser`)

1. Para cada caso: chama o parser real (mesmo caminho de produção — extrair a chamada para uma
   função pura testável se hoje estiver acoplada ao service).
2. Compara campo a campo; acumula acertos por campo e por caso.
3. Report: acurácia geral, acurácia por campo (`isRunningRelated: 98% | targetDistance: 84% | ...`),
   lista dos casos errados com diff, custo total e nº de chamadas.
4. Grava JSON em `eval/reports/goal-parser-<timestamp>.json`; comando `--compare <report>` mostra
   regressões/melhoras caso a caso contra uma rodada anterior. **Esse compare é o produto
   principal**: é ele que responde "meu novo prompt melhorou?".

### Critérios de aceite

- Dataset ≥ 50 casos cobrindo todas as dimensões acima.
- `npm run eval:goal-parser` roda em < 10 min, custo estimado impresso no final.
- `--compare` aponta cada caso que mudou de resultado entre duas rodadas.
- Baseline registrado (número documentado no report inicial versionado).

---

## Demanda 2 — Eval do planner semanal (o eval principal)

### Dataset de perfis (`eval/datasets/planner-profiles-v1.json`, 30–50 perfis)

Perfis sintéticos que exercitam o produto de verdade. Construir por matriz de dimensões:

| Dimensão | Valores |
|---|---|
| Nível | iniciante absoluto, iniciante, intermediário, avançado |
| Meta | começar a correr, 5k, 10k com tempo, meia, maratona, meta irrealista |
| Disponibilidade | 2, 3, 4, 6 dias/semana |
| Histórico | sem histórico, 4 semanas consistentes, semana anterior falhada (baixa completionRate), volta de lesão |
| Guardrails | com/sem `weeklyVolumeMaxKm`, `goalAttemptAllowed` false |

Cada perfil é um fixture com os MESMOS tipos que produção usa (`AiPlannerInput`,
`UserProfileContext`, `PlannerGuardrails`, `LongitudinalWeek[]`) + as expectativas:

```json
{
  "id": "beginner-3days-couch-to-5k",
  "description": "Iniciante absoluto, 3 dias disponíveis, meta 5k em 12 semanas",
  "input": { "...": "AiPlannerInput completo" },
  "expectations": {
    "l2": {
      "weeklyVolumeKm": { "min": 8, "max": 18 },
      "maxWorkoutsPerDay": 1,
      "mustUseOnlyDays": ["mon", "wed", "sat"],
      "maxIntensityShare": 0.2,
      "volumeIncreaseVsPreviousWeekMaxPct": 10
    },
    "judgeHints": "Iniciante: nada de tiros longos, progressão conservadora, linguagem encorajadora."
  }
}
```

Casos-armadilha obrigatórios (é onde LLM erra):

- **Meta irrealista** ("maratona em 3 semanas, nunca corri"): plano deve ser conservador e a
  avaliação (`buildAssessmentPrompt`/`goal-feasibility`) deve sinalizar inviabilidade — não
  entregar um plano suicida.
- **Semana anterior 30% completada**: o plano novo deve REDUZIR ou manter volume, nunca progredir
  como se tudo tivesse sido feito.
- **2 dias disponíveis + meta ambiciosa**: respeitar os 2 dias (não inventar treino na quinta).
- **Volta de lesão**: sem intensidade alta na primeira semana.

### Camada L1 — validação estrutural (reaproveitar código existente)

Para cada plano gerado: `validateSegmentTree` em todo dia, `isStructurallyCompleteRun`,
dias dentro de `availableDays`, volume ≤ `weeklyVolumeMaxKm`, sem dias degenerados.
Falha em L1 = nota zero no caso e listagem do motivo. (É a mesma lógica do retry interno do
`gemini.service.ts`, promovida a critério de avaliação externa.)

### Camada L2 — métricas determinísticas

Funções puras plano → número, comparadas às faixas do fixture: volume semanal km, % de treino
em alta intensidade, incremento vs. semana anterior, distribuição warmup/work/cooldown,
coerência com a `PlannedWeek` da periodização determinística. Reaproveitar/extrair o que já
existe em `weekly-metrics.util.ts`.

### Camada L3 — LLM-as-judge (`eval/judges/plan-quality-judge.ts`)

- **Modelo do judge ≠ modelo do gerador** (mitiga self-preference bias). Se o planner usa
  Gemini, julgar com um modelo diferente/maior; no mínimo, um modelo Gemini de tier superior
  com temperatura 0.
- Input do judge: perfil do atleta (resumido), plano gerado (serializado legível), `judgeHints`
  do fixture, e a rubrica. Output: structured output com nota 1–5 + justificativa POR CRITÉRIO.

Rubrica proposta (calibrar com um treinador ou material de referência):

1. **Adequação ao nível** — cargas compatíveis com o histórico e experiência?
2. **Coerência com a meta** — os treinos constroem em direção à prova/objetivo?
3. **Progressão segura** — respeita o princípio de sobrecarga gradual? sinais de risco de lesão?
4. **Estrutura das sessões** — aquecimento/trabalho/desaquecimento fazem sentido? zonas/paces coerentes entre si?
5. **Resposta ao histórico** — o plano reage à semana anterior (completada ou falhada)?
6. **Realismo** — volume/dias cabem na disponibilidade declarada?

Regras anti-flakiness do judge: temperatura 0; N=3 julgamentos por caso e mediana por critério
(ou N=1 com flag `--cheap` para iteração rápida); nota final do caso = média ponderada com
L1 eliminatório.

### Runner (`npm run eval:planner`)

1. Para cada perfil: gera o plano pelo caminho real (`ai-planner.service` — expor um entrypoint
   avaliável que não dependa de HTTP/banco, injetando fixtures; provavelmente já é possível via
   os tipos existentes).
2. Roda L1 → L2 → L3; acumula custo usando o `AiPlannerUsage` já existente.
3. Report markdown + JSON: score médio geral, score por critério da rubrica, taxa de falha L1,
   piores 5 casos com justificativa do judge, custo total da rodada, `--compare` contra rodada
   anterior (igual à Demanda 1).

### Critérios de aceite

- ≥ 30 perfis cobrindo a matriz + os 4 casos-armadilha.
- Rodada completa custa < US$ 2 e roda em < 30 min (paralelizar chamadas com limite de concorrência).
- Judge produz justificativa legível por critério (amostras revisadas manualmente batem com a intuição — validação do próprio judge com ~10 planos julgados por humano antes de confiar).
- Report `--compare` funcional; baseline documentado.
- README em `eval/` explicando: como rodar, como adicionar perfil, como interpretar, quando rodar (antes de todo merge que toque prompts/modelo).

---

## Demanda 3 — Eval de regressão de modelo (deriva das demandas 1 e 2)

Quando sair modelo novo (ou para testar tier mais barato): `npm run eval:planner -- --model <nome>`
e `eval:goal-parser -- --model <nome>` rodam o MESMO dataset contra o modelo candidato e o
report compara qualidade E custo lado a lado. A decisão "migrar ou não" vira uma tabela:

```
                     gemini-2.5-flash   candidato-x
goal-parser acc      91%                93%
planner score        4.1/5              4.3/5
falhas L1            2/40               1/40
custo por plano      $0.011             $0.006
```

Requisito: os runners recebem o modelo por flag/env em vez de constante hardcoded — hoje o
modelo está fixo no `gemini.service.ts`; extrair para config injetável é pré-requisito desta
demanda (e boa prática de qualquer forma).

---

## Decisões e pontos de atenção

- **Framework**: começar SEM framework (scripts TS + `node --test`/ts-node), porque o valor está
  no dataset e na rubrica. Avaliar `promptfoo` depois, se a manutenção dos runners pesar.
- **Cache de geração**: rodadas de eval do judge podem reavaliar planos já gerados (separar
  fase "gerar" da fase "julgar" com artefatos intermediários em disco) — permite iterar na
  rubrica sem pagar geração de novo.
- **Não-determinismo do gerador**: mesmo prompt gera planos diferentes. Para comparações de
  prompt A vs B, gerar N=3 planos por perfil e comparar distribuições, não pontos únicos
  (flag `--runs 3`).
- **Custo do judge**: é a parte cara. Ordem das camadas existe para o judge só ver o que passou
  em L1/L2.
- **Dataset é código**: casos novos entram por PR; todo bug de produção que envolver plano ruim
  DEVE virar um caso no dataset (regression test cultural).
- **Onde NÃO usar judge**: goal parser (Demanda 1) é comparação determinística — não gastar
  judge onde código resolve.

## Ordem sugerida

1. Demanda 1 inteira (mecanismo + baseline). 
2. Demanda 2: fixtures + L1/L2 primeiro (já é útil sozinho, custo zero de judge) → depois L3.
3. Demanda 3 (flag de modelo) por último — quase grátis depois das outras.

## Questões em aberto para o agente de planejamento

1. O entrypoint do planner é chamável hoje sem HTTP/banco (fixtures puros)? Se não, qual o menor refactor para injetar `AiPlannerInput` direto?
2. Reports versionados no git ou só baselines? (proposta: versionar baselines nomeados, gitignorar o resto)
3. Qual modelo usar como judge? (restrição: chave/conta disponível; proposta: tier superior do próprio Gemini com temperatura 0 se não houver segunda API)
4. Vale gerar os perfis sintéticos com LLM e revisar na mão, ou escrever todos manualmente? (proposta: gerar com LLM, revisar 100% na mão — o dataset é pequeno)
