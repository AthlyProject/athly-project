# Suíte de evals do planner — relatório de 20/10/2026

Execução `2026-10-20_151139`, na branch `feat/leva5-motor-viabilidade-rpe` (PR #29, sem merge), contra
o backend local, com o Gemini real (`gemini-3-flash-preview`, prompt `v3.2-hr-guidance`).

**Resultado: 19 de 19 casos passaram, 5 deles com aviso, e nenhuma falha.** Rodaram 227
verificações: 221 ok e 6 avisos. O custo estimado foi de US$ 0,50, em 10,6 min de geração (33 s por
caso, em média).

O relatório bruto que a suíte gera, com o detalhe de cada caso e todos os treinos, está ao lado:
`2026-10-20_151139-relatorio-bruto.md`.

---

## 1. O que é a suíte

A suíte gera planos de verdade pela API local, na mesma ordem de chamadas do app, e confere cada
plano como um teste. Ela substituiu o eval antigo, que só listava os resultados sem julgar.

- **Comando:** `./cenarios.sh eval`, no `athly-backend`. Filtros: `--tag`, `--caso`, `--repetir`,
  `--max-usd`, `--listar`.
- **Código:** `athly-backend/prisma/cenarios/eval/`, com o uso descrito em `prisma/cenarios/README.md`.
- **Saída:** `.cenarios/eval/<carimbo>/`, com `relatorio.md`, `resultados.json` e uma pasta por caso
  (prompt, resposta e entrada).
- **Código de saída:** 1 se algum caso falhar. Serve de trava antes de um merge.
- **Histórico:** `.cenarios/eval/historico.json` guarda o último resultado de cada caso, e o relatório
  mostra o que mudou desde a execução anterior.
- **Limite de custo:** padrão de US$ 2. A suíte para de começar casos quando chega nele.

### Como um caso roda
1. Zera a conta de teste do perfil.
2. Faz login e envia o onboarding (`POST /assessment`) com a meta do caso.
3. Monta o Health:
   - **Perfis do iOS:** saem do `MockHealthKitService` real do app, compilado pelo eval, o mesmo do
     simulador.
   - **Personas de plano em andamento:** o eval semeia no banco 12 semanas de um plano de meia, com os
     treinos prescritos, o que foi feito, o feedback e o Health correspondente.
4. Envia a FC de repouso e o contexto do Health, como o `PlannerHealthSyncService` do app.
5. **Onboarding:** pede a análise da meta (`POST /ai-planner/goal-analysis`) antes da geração, como o
   app novo faz.
6. **Troca de meta:** chama `PUT /goals/active` antes da geração, como o "Alterar meta" do app.
7. Gera a semana (`plan-from-health/async`) e acompanha até concluir.
8. Mede a geração (o que o backend pediu no prompt, a viabilidade gravada e o plano treino a treino) e
   roda as verificações.

### Níveis
- **Falha:** comportamento errado. O caso falha e a suíte sai com código 1.
- **Aviso:** vale olhar, mas pode ser variação da IA ou imprecisão do eval. O volume do plano é
  estimado: trechos por tempo sem pace usam o pace de conforto do onboarding.

---

## 2. Os casos

### Perfis do iOS (Health do `MockHealthKitService`)

| Perfil | Health enviado | Onboarding |
|---|---|---|
| vazio | nenhuma corrida | Começando, conforto 7:30/km, seg/qua/sex |
| gps | 10 corridas, 10,2 km/sem, maior 8 km, pace médio 7:12/km, com FC, splits da rota | Iniciante, conforto 7:10/km, ter/qui/sáb |
| resumo | 20 corridas, 22,7 km/sem, maior 13 km, 6:02/km, sem FC, splits sintéticos | Hobby, conforto 6:00/km, ter/qui/sáb/dom |
| medio | 21 corridas, 24,5 km/sem, maior 13 km, 5:32/km, com FC e FC de repouso 56 | Intermediário, conforto 5:35/km, seg/qua/sex/dom |
| veloz | 27 corridas, 47,8 km/sem, maior 21,1 km, 4:41/km, sem FC | Avançado, conforto 4:55/km, seg/ter/qui/sáb/dom |

Com a leitura por janela do app (as corridas das últimas 9 semanas, de 20 a 60), o medio passou a
mandar 21 corridas e o veloz 27, em vez de 20.

Cada perfil roda **3 metas**, com datas relativas a hoje:
- meia sub-2h em 10 semanas (03/01/2027);
- 5 km sub-25 em 6 semanas (06/12/2026);
- meia sem tempo alvo no domingo da semana que vem (01/11/2026).

### Personas de plano em andamento (semeadas no banco)

| Persona | O que fez nas 12 semanas | Fonte |
|---|---|---|
| disciplinado | 48 de 48 treinos, longões até 18 km, teste de 10 km em 49:30 (VDOT 40,5) | Garmin, com FC e FC de repouso 50 |
| irregular | 28 de 48 treinos feitos, 3 parciais, 17 pulados, 2 corridas fora do plano; maior 14,7 km; melhor esforço 10 km em 53:50 (VDOT 36,7) | iPhone, sem FC |

| Caso | Situação |
|---|---|
| `disciplinado/semana-da-prova` | A semana da meia sub-2h, com a prova neste domingo |
| `irregular/semana-da-prova` | A mesma semana, para quem está no limite da meta |
| `disciplinado/semana-de-construcao` | Uma semana da fase de construção, 6 semanas antes da prova |
| `disciplinado/troca-de-meta` | No meio do ciclo, troca a meia por um 10 km em 50:00 na mesma data e gera a semana |

---

## 3. Resultado por caso

### Primeiro plano depois do onboarding

| Caso | Resultado | Veredito | Análise antes do plano: alternativas | Plano da semana | Geração |
|---|---|---|---|---|---|
| vazio · meia 10 sem | passou | unrealistic (preliminar) | nenhuma (sem corridas) | avaliação: 2 sessões, ~9,5 km | 18 s · US$ 0,011 |
| vazio · 5 km 6 sem | passou | unrealistic (preliminar) | nenhuma | avaliação: 2 sessões | 30 s · US$ 0,015 |
| vazio · meia próxima | passou | — (sem tempo alvo) | nenhuma | avaliação: 2 sessões | 18 s · US$ 0,011 |
| gps · meia 10 sem | aviso | unrealistic (preliminar) | 5K em 35:00 | 3 treinos, ~12,7 km | 21 s · US$ 0,019 |
| gps · 5 km 6 sem | aviso | unrealistic | 5K em 35:00 | 3 treinos, ~13,3 km | 21 s · US$ 0,018 |
| gps · meia próxima | passou | — | Completar 5K | polimento: 3 treinos, ~9,1 km | 51 s · US$ 0,041 |
| resumo · meia 10 sem | aviso | unrealistic | 10K em 58:30 | 4 treinos, ~29,7 km | 24 s · US$ 0,019 |
| resumo · 5 km 6 sem | passou | unrealistic | 5K em 28:30 | 4 treinos, ~28,0 km | 54 s · US$ 0,040 |
| resumo · meia próxima | passou | — | Completar 10K | polimento: 4 treinos, ~20,4 km | 60 s · US$ 0,042 |
| medio · meia 10 sem | passou | feasible | 15K em 1:23:00 | 3 treinos, ~27,6 km | 30 s · US$ 0,024 |
| medio · 5 km 6 sem | passou | ready | nenhuma (meta pronta) | 3 treinos, ~29,1 km | 39 s · US$ 0,039 |
| medio · meia próxima | passou | — | Completar 15K | polimento: 3 treinos, ~19,7 km | 30 s · US$ 0,021 |
| veloz · meia 10 sem | passou | ready | nenhuma | 4 treinos, ~51,3 km | 48 s · US$ 0,038 |
| veloz · 5 km 6 sem | passou | ready | nenhuma | 4 treinos, ~49,0 km | 30 s · US$ 0,023 |
| veloz · meia próxima | passou | — | nenhuma (resistência confirmada) | polimento: 4 treinos, ~34,7 km | 27 s · US$ 0,021 |

### Plano em andamento

| Caso | Resultado | Veredito | Fase pedida pelo backend | Plano da semana | Geração |
|---|---|---|---|---|---|
| disciplinado · semana da prova | passou | **ready** | semana da prova: alvo ~11,2 km além da prova | 4 treinos, ~38,1 km incluindo a prova | 51 s · US$ 0,046 |
| irregular · semana da prova | passou | ambitious | semana da prova: alvo ~8,8 km além da prova | 4 treinos, ~32,5 km incluindo a prova | 30 s · US$ 0,022 |
| disciplinado · troca de meta | passou | unrealistic (10 km em 50:00) | **BASE**, recomeçada na troca: alvo ~34,7 km, longão ~12,5 km | 4 treinos, ~41,0 km | 27 s · US$ 0,023 |
| disciplinado · construção | aviso | feasible | BUILD: alvo ~44,4 km, longão ~15,5 km | 4 treinos, ~46,6 km | 27 s · US$ 0,022 |

---

## 4. Análise da meta antes do plano

É a parte nova desta rodada. A análise roda antes da geração, sem IA e sem custo, e a suíte confere
quatro coisas:
- **`analise-coerente`:** o veredito da análise é o mesmo que a geração grava depois. Valeu em 10 de 10
  casos com veredito.
- **`alternativas-na-mesma-data`:** cada alternativa usa a data da meta, uma distância de prova até a da
  meta, tempo múltiplo de 30 s, e são no máximo 3. Valeu em 15 de 15 casos.
- **`sem-alternativa-sem-dados`:** sem corridas, ou com a meta já pronta, não há alternativa. Valeu em
  6 de 6 casos.
- **O texto da tela:** foi conferido abaixo, caso a caso.

O que a análise mostrou, perfil a perfil:
- **vazio:** "Vamos conhecer o seu ritmo". A primeira semana é de avaliação. Não há alternativas: elas
  sairiam de um VDOT padrão, e não do atleta.
- **gps:** "Meta difícil para esta data".
  - Meia: "a projeção é 2:24:04, acima da meta de 2:00:00", e a resistência não foi demonstrada (maior
    8 km contra referência de 15,8 km).
  - A alternativa é **5K em 35:00**. O motor só confirma o 5 km, porque o volume de ~10 km por semana
    não sustenta um 10 km.
- **resumo:** meia → **10K em 58:30**; 5 km sub-25 → **5K em 28:30** (outro tempo, mesma prova).
- **medio:** meia "viável", com o aviso de resistência (13 contra 15,8 km) e a alternativa **15K em
  1:23:00**; o 5 km está pronto, sem alternativa.
- **veloz:** pronto nas duas metas, sem alternativas.
- **Metas sem tempo alvo:** só o eixo da distância, para completar: **Completar 5K**, **10K** ou
  **15K** no mesmo dia.

**Detalhe que vale saber:** os números da tela e das alternativas vêm de cálculos diferentes.
- A projeção do VDOT usa o melhor esforço, inclusive os sub-esforços das sessões detalhadas, e projeta
  a evolução até a prova. Para o 5 km do gps, ela dá 32:35 no dia da prova.
- A alternativa do motor objetivo usa o que as corridas já confirmam hoje, sem projetar evolução: 5K em
  35:00.

Por isso a alternativa é a mais conservadora das duas. O veredito continua o mesmo que a geração grava,
porque sai do mesmo cálculo.

---

## 5. Semana da prova

Na véspera vale a regra combinada hoje: uma ativação curta de até ~30 min, com no máximo ~1 km ou tiros
curtos no ritmo de prova e RPE até 6. A antevéspera fica em RPE até 4. O gate barra o que passar disso.

**disciplinado** (pronto). A prontidão está demonstrada: maior corrida 18 km e 37,7 km por semana.

| Dia | Treino |
|---|---|
| ter | Rodagem de manutenção, ~6 km (3 km em RPE 4, Z2) |
| qui | Toque no ritmo de prova: 2 km a 5:31–5:51/km, RPE 6 |
| sex | Descanso pré-prova |
| sáb | Ativação: 8 min + 1 km leve (RPE 3) + 5 min, ~19 min |
| **dom** | **Prova:** 10 min + 21,1 km a 5:31–5:51/km (RPE 8, Z4) + 10 min |

**irregular** (ambicioso). A resistência não está demonstrada: 14,7 km de maior corrida e 21 km por
semana. A análise da IA diz isso com os números e pede para completar com segurança.

| Dia | Treino |
|---|---|
| ter | Rodagem de polimento, ~3 km |
| qui | Ativação com 3 retas de 20 s em RPE 6 |
| sex | Descanso |
| sáb | Trote de véspera: 8 min + 500 m + 5 min |
| **dom** | **Prova:** 10 min + 21,1 km a 5:31–5:51/km (RPE 8) + 5 min |

Verificações que passaram nos dois casos:
- **`prova-marcada`:** uma tentativa só, no domingo, com a distância inteira.
- **`vespera-leve`:** véspera e antevéspera dentro da regra.
- **`resto-da-semana-leve`:** fora a prova, volume perto do alvo e nada em RPE 8 ou mais.
- **`pace-da-prova`:** o ritmo de prova bate com a meta, 5:41/km.
- **`estrategia-conservadora`:** valeu para o irregular.

---

## 6. Troca de meta no meio do ciclo

O caso `disciplinado/troca-de-meta` reproduz um "Alterar meta" do app. O plano de meia estava na
semana 7 (fase de construção); o atleta troca por um 10 km em 50:00 na mesma data e gera a semana.

| O que se verificou | Resultado |
|---|---|
| `troca-plano-religado` | O plano passou a apontar para a meta nova: objetivo "Treinar para 10K em 50:00" |
| `troca-fase-reancorada` | Fase **BASE**: o macrociclo do 10 km recomeça na semana da troca, com o volume atual. Sem a troca, seria BUILD da meia |
| `troca-semanas-preservadas` | As 6 semanas entregues ficaram; agora são 7 geradas. Os 24 treinos antigos continuam, mais os 7 dias da semana nova |
| Veredito | unrealistic: o 10 km em 50:00 pede VDOT 40, e o atleta está em 37,1 nesta semana do plano |

A semana gerada para o 10 km tem 4 treinos e ~41 km:
- terça: limiar, 3×2 km em RPE 7;
- quinta: base, 6 km em RPE 4;
- sábado: rodagem leve, 5 km;
- domingo: longão de 15 km, com 12 km em RPE 5.

A fase BASE aceita um único treino em RPE 7 ou mais, e o longão fica dentro de 1,25 × a referência de
12,5 km.

---

## 7. Semana de construção

Em `disciplinado/semana-de-construcao`, a referência do longão agora é **15,5 km**: ela é recalculada
a partir do maior treino recente, 15,7 km. Antes da correção de hoje, ficava congelada em 13,2 km, o
valor do início do plano.

O plano tem:
- terça: cruise intervals de 4×2 km em RPE 7;
- quinta: rodagem de manutenção;
- sábado: rodagem leve com retas;
- domingo: longão progressivo de 16 km.

Isso fica dentro da fase e do teto de 44,45 km.

---

## 8. Avisos (nenhuma falha)

| Caso | Aviso | Leitura |
|---|---|---|
| gps · meia 10 sem | `teto-de-volume`: ~12,7 km para teto de 11,2 km (113%) | A IA passa um pouco do teto. O gate do backend aceita até 25% acima, e o eval estima os trechos por tempo pelo pace de conforto |
| gps · 5 km 6 sem | `teto-de-volume` (119%) e `volume-vs-historico`: 13,3 contra 10,2 km/sem (131%) | Mesmo motivo; para um iniciante, vale acompanhar |
| resumo · meia 10 sem | `teto-de-volume` (113%) e `volume-vs-historico` (131%) | Mesmo padrão: ~30 km para quem faz ~23 |
| disciplinado · construção | `volume-vs-historico`: 46,6 contra 34,7 km/sem (134%) | Esperado. A média das últimas 4 semanas inclui a semana de recuperação, e contra a semana anterior (40,4 km) o plano fica dentro do teto |

O padrão que se repete: em perfis de volume baixo, a IA tende a planejar 10–20% acima do teto pedido.
O gate não barra porque a tolerância dele é de 25%. Se quiser apertar, o lugar é essa tolerância, em
`assessPlanQuality`.

---

## 9. Custo e tempo

- **Total:** US$ 0,50 em 19 gerações, ~US$ 0,026 por caso. A análise da meta não usa IA e não custa.
- **Mais caros:** os polimentos de prova próxima (US$ 0,041–0,042) e a semana da prova do disciplinado
  (US$ 0,046), que pensam mais (5.200–5.900 tokens de raciocínio).
- **Mais baratos:** as semanas de avaliação do vazio (US$ 0,011, ~1.200 tokens de raciocínio).
- **Tempo:** de 18 a 60 s por geração. Nenhuma geração travou (antes da correção do schema, o modo FC
  travava por 5 min).

---

## 10. Evolução das execuções de hoje

| Execução | O que rodou | Resultado | Custo |
|---|---|---|---|
| 06:53 | eval antigo (15 casos) | 12 ok; as 3 do medio travaram no modo FC (bug do `"rpe": 3000…`) | US$ 0,30 |
| 07:48 | medio de novo, depois da correção do schema | 3 de 3 | US$ 0,12 |
| 11:02 | eval antigo, depois de todas as correções | 15 de 15, sem verificações automáticas | US$ 0,32 |
| 12:06 | suíte nova, só plano em andamento | 1 de 3 (achou o veredito errado do disciplinado e o longão congelado) | US$ 0,09 |
| 12:09 | suíte nova completa | 16 de 18 | US$ 0,44 |
| 12:25 | depois das correções (longão, véspera, leitura por janela) | 18 de 18 (4 avisos) | US$ 0,53 |
| **15:11** | **com a análise antes do plano e a troca de meta** | **19 de 19 (5 avisos)** | **US$ 0,50** |

Mudanças desde a execução das 12:25, apontadas pelo próprio relatório da suíte:
- `disciplinado/semana-da-prova` e `irregular/semana-da-prova` foram de aviso para **passou**: o volume
  fora da prova ficou perto do alvo.
- `gps/5k-sub25-6-semanas` e `resumo/meia-sub2h-10-semanas` foram de passou para **aviso**: o volume
  ficou acima do teto, a variação da IA descrita na seção 8.

---

## 11. O que a suíte não cobre

- **A tela do app.** A suíte chama a API; o fluxo no iPhone (onboarding → análise → plano, e "Alterar
  meta") precisa do teste manual no simulador ou no aparelho.
- **Android.** Ele ainda lê só as 20 corridas mais recentes e não tem a tela nova.
- **Volume exato.** Os volumes são estimados pelo eval. A régua oficial é o gate do backend.
- **Repetição.** Cada caso roda uma vez. Para separar variação da IA de regressão, use
  `--caso <id> --repetir 3`.
- **Prova no domingo.** Rodando no domingo, a prova dos casos de semana da prova é no mesmo dia.
