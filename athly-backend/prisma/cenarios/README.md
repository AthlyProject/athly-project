# Cenários e evals do planner

Contas de teste no banco local e uma suíte de evals que gera planos de verdade (Gemini) pela API
local, na mesma ordem de chamadas do app, e confere cada plano como um teste.

## Antes de rodar

1. Postgres local no ar (container `iafit-postgres`). Os scripts se recusam a rodar se o
   `DATABASE_URL` não apontar para o banco local, porque apagam dados das contas de teste.
2. Backend local no ar em `http://localhost:4000` (`npm run start:dev`), com
   `PLAN_GENERATION_INLINE=true` no `.env` (o worker local substitui a fila SQS).
3. `swiftc` instalado (Xcode): o Health dos perfis do iOS sai do `MockHealthKitService` real.
4. As contas criadas uma vez: `./cenarios.sh seed`.

Cada geração custa de US$ 0,01 a 0,04 em créditos do Gemini. A suíte inteira fica em torno de
US$ 0,50.

## Comandos

```bash
./cenarios.sh eval                         # a suíte inteira
./cenarios.sh eval --listar                # os casos e o custo estimado, sem rodar
./cenarios.sh eval --tag semana-da-prova   # só os casos com essa tag (várias: --tag a,b)
./cenarios.sh eval medio                   # só os casos de um perfil
./cenarios.sh eval --caso veloz/meia-sub2h-10-semanas --repetir 3   # variação da IA
./cenarios.sh eval --max-usd 1             # para de começar casos depois de US$ 1 (padrão 2)
```

O eval sai com código 1 se algum caso falhar ou der erro.

O resultado fica em `.cenarios/eval/<carimbo>/`:
- `relatorio.md`: resumo, falhas e avisos, perfis e o detalhe de cada caso.
- `resultados.json`: as mesmas informações em JSON.
- Uma pasta por caso, com o prompt, a resposta e a entrada.

`.cenarios/eval/historico.json` guarda o último resultado de cada caso. Assim o relatório mostra
o que passou a falhar e o que voltou a passar desde a execução anterior.

Os outros comandos (`seed`, `reset`, `acompanhar`, `exportar`) servem para testar no simulador
com as mesmas contas: veja `cli.ts`.

## Quando rodar

- Antes de subir mudanças no prompt, no schema de resposta, nos gates, na periodização ou na
  viabilidade.
- Ao trocar o modelo.
- Para investigar um caso: use `--caso` com `--repetir` e veja se o problema se repete.

## Casos

Os casos estão em `eval/casos.ts`. As datas são relativas a hoje (o domingo de uma semana futura),
para os vereditos esperados não mudarem com o calendário.

| Tag | O que cobre |
|---|---|
| `onboarding` | O primeiro plano depois do onboarding, para os 5 perfis do iOS × 3 metas (meia em 10 semanas, 5 km em 6 semanas, meia sem tempo alvo a 12 dias) |
| `avaliacao` | Sem corridas no Health: a semana de avaliação (perfil `vazio`) |
| `fc` | Prescrição por FC + RPE (`medio`, `disciplinado`) |
| `plano-em-andamento` | Uma semana do meio ou do fim de um plano, com as semanas anteriores semeadas no banco |
| `semana-da-prova` | A semana da prova de quem cumpriu o plano (`disciplinado`) e de quem fez ~60% dele (`irregular`) |
| `construcao` | Uma semana da fase de construção, 6 semanas antes da prova (`disciplinado`) |
| `troca-de-meta` | Troca a meia por um 10 km na mesma data, no meio do ciclo, e gera a semana (`disciplinado`) |

Nos casos de `onboarding` o eval também chama a análise da meta (`POST /ai-planner/goal-analysis`)
antes da geração, como o app faz. A análise não usa a IA e não tem custo.

Os perfis do iOS (`vazio`, `gps`, `resumo`, `medio`, `veloz`) estão descritos em `base.ts`. As
personas de plano em andamento (`disciplinado`, `irregular`) estão em `eval/plano-em-andamento.ts`.
Para elas, o eval semeia um plano de meia de 13 semanas: os treinos prescritos, o que foi feito,
o feedback e o Health correspondente. O Health enviado segue a leitura do app (`HealthRunWindow`
no iOS): as corridas das últimas 9 semanas, de 20 a 60, e a data desde quando todas foram lidas. Essas duas contas são só do eval: no simulador, elas recebem
o Health padrão do mock.

## Verificações

Estão em `eval/verificacoes.ts`. Cada uma vale só para os casos em que se aplica.
- **Falha:** o comportamento está errado.
- **Aviso:** vale olhar, mas pode ser variação da IA ou imprecisão do eval. Os volumes do plano são
  estimados, e trechos por tempo sem pace usam o pace de conforto do onboarding.

| Verificação | Nível | Confere |
|---|---|---|
| `tipo-de-geracao` | falha | Sem corridas gera a semana de avaliação; com corridas, o plano normal |
| `veredito` | falha | Veredito e confiança da viabilidade gravada, como o caso espera |
| `dias-escolhidos` | falha | Treinos só nos dias escolhidos no onboarding |
| `nada-depois-da-prova` | falha | Nenhum treino depois da data da prova |
| `fc` | falha | Modo FC: zona onde se aplica, nenhuma em tiro curto ou recuperação, zona coerente com o RPE. Modo RPE: nenhuma meta de FC |
| `protocolo-de-avaliacao` | falha | Semana de avaliação só por tempo, sem pace alvo, RPE até 6, blocos de 5 min ou mais |
| `teto-de-volume` | aviso | Volume até o teto da semana (folga de 10%) |
| `piso-de-volume` | falha | Fora do polimento, volume de pelo menos 80% do alvo da fase |
| `longao-da-fase` | aviso | Maior treino entre 75% e 130% do longão de referência |
| `limites-da-base` | falha | Fase BASE: no máximo 1 treino em RPE 7+ e maior treino até ~1,25 × o longão |
| `referencia-do-longao` | falha | Plano em andamento: a referência do longão acompanha o maior longão das últimas 4 semanas |
| `volume-vs-historico` | aviso | Volume até 1,3 × a média semanal real das últimas 4 semanas (independe dos números do backend) |
| `longao-vs-historico` | aviso | Maior treino até 1,25 × a maior corrida real das últimas 4 semanas |
| `sem-historico` | aviso | Sem corridas no Health, nenhum treino passa de ~5 km |
| `aviso-de-prontidao` | aviso | Prova a até 4 semanas sem resistência demonstrada: a análise avisa |
| `prova-marcada` | falha | Semana da prova: uma tentativa, no dia da prova, com a distância inteira |
| `vespera-leve` | falha | Semana da prova: antevéspera até RPE 4; véspera em descanso ou ativação curta (até ~35 min, RPE até 6, ~1 km forte) |
| `resto-da-semana-leve` | aviso | Semana da prova: fora a prova, volume perto do alvo e nada em RPE 8+ |
| `pace-da-prova` | aviso | Meta com tempo: pace da prova entre 3% mais rápido e 8% mais lento que o alvo |
| `estrategia-conservadora` | aviso | Semana da prova sem prontidão confirmada: pede ritmo controlado |
| `analise-coerente` | aviso | O veredito da análise antes do plano é o mesmo que a geração grava |
| `alternativas-na-mesma-data` | falha | Alternativas na data da meta, em distâncias de prova até a da meta, tempos em 30 s, no máximo 3 |
| `sem-alternativa-sem-dados` | falha | Sem corridas, ou com a meta já pronta, nenhuma alternativa |
| `troca-fase-reancorada` | falha | Troca de meta: o macrociclo recomeça na semana da troca (fase de base) |
| `troca-semanas-preservadas` | falha | Troca de meta: semanas entregues e treinos ficam; só a semana nova é gerada |
| `troca-plano-religado` | falha | Troca de meta: o plano aponta para a meta nova |

## Como acrescentar

- **Um caso com um perfil que já existe:** acrescente um item em `casos()`, em `eval/casos.ts`.
  Diga a situação, as tags, o objetivo e os vereditos aceitos.
- **Uma persona de plano em andamento:**
  1. Descreva a persona em `PERSONAS`, em `eval/plano-em-andamento.ts`: longões, execução por
     semana, paces, FC e treinos especiais.
  2. Crie a conta em `base.ts` (`CENARIOS` e `PERFIS`).
  3. Acrescente as respostas de onboarding em `ONBOARDING`, em `eval/casos.ts`.
  4. Rode `./cenarios.sh seed`.
- **Uma verificação:** acrescente um item em `VERIFICACOES`, com `aplica` (para quais casos
  vale) e `avaliar` (devolve `ok` e um detalhe legível). Use `falha` para o que é defeito
  com certeza e `aviso` para o que depende de julgamento.

## Limitações

- O eval mede o que o backend gravou e o prompt que ele montou. A interpretação de um aviso
  continua sendo de quem lê o relatório.
- Os casos de semana da prova colocam a prova no domingo desta semana. Rodando num domingo, a
  prova é no mesmo dia.
- As personas de plano em andamento usam a periodização do backend do momento da semeadura.
  Uma mudança no `buildMacrocycle` muda o plano que elas "seguiram".
