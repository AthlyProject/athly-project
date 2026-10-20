# Motor puro de viabilidade e prescrição

Fachada: `index.ts`. Versões: `goal-feasibility/1.1.0` e
`duration-rpe/1.0.0`. Consome o contrato de viabilidade, D15 do adendo R1,
adendo RPE, fechamento RPE reconferido pela R4 e ajuste de produto RPE.
Este diretório não é registrado no módulo Nest nem chamado pelos escritores atuais.

## Composição para os adaptadores seguintes

1. `mergeObjectiveCapture` preserva a captura útil quando uma leitura falha ou vem
   vazia. `normalizeObjectiveEvidence` classifica origem, deduplica, aplica
   quarentena e conserva incógnitas. `assessGoal`, `goalAlternatives` e
   `objectivePaceContext` usam somente a evidência objetiva admissível.
2. `reviseDeclaration`, `timerDurationSource` e `normalizeDurationSessions` mantêm
   revisões efetivas, heads independentes, tombstones e relações. A identidade de
   duração não muda em uma revisão apenas de ratings. Em divisões de grupos, o
   adaptador deve conservar os `HeadBarrier` e aliases já comprometidos.
3. `deriveDurationBaseline` e `historicalResumeAnchor` calculam suporte de duração
   sem transformar relatos em medidas da meta. Inventário tem hash específico do
   intervalo; não é cobertura objetiva. A retomada valida os fatos na última
   corrida anterior à interrupção e exige fontes ainda existentes.
4. `createPrescription` executa o seletor, controle, calendário e árvores por
   duração. `evaluateFeasibility` compõe a avaliação completa. Todos os IDs de
   avaliação, ocorrência, fonte e episódio vêm do chamador; hashes derivados são
   determinísticos. Metros, segundos, datas civis e instantes UTC têm campos próprios.
5. `validateFinalWeek` valida a representação executável final. Duração exige a
   árvore e o calendário congelados. Pace expande sets, soma os extremos de tempo
   e distância e verifica janelas parciais e trechos contínuos, incluindo
   recuperações corridas. Descrições livres são substituídas por texto derivado.
   `validateAttempts` admite até três tentativas; `validatedFallback` conserva o
   mesmo snapshot e validador. Fallback de pace é fornecido pelo adaptador.
6. `proposeDose` faz preview sem consumir. `commitDoseDelivery` recebe um evento
   explícito de entrega positiva e devolve `nextState`, `DoseCommit`, recibo de
   replay e transições de episódio propostas. Uma entrega sem sessões positivas
   não altera referência, recibos, barreira ou consumo de progressão.

## Fronteira transacional

`SourceFact` descreve fatos lidos pelo chamador; não atesta autorização, existência
no banco, lock ou lease. `expiresAt` é um vencimento independente da fonte, exclusivo;
não deve representar um prazo universal de sete dias para todo histórico de saúde.
O motor calcula separadamente `validThrough`, inclusivo, para o frescor consumido
por pace. Duração pode consumir contexto válido com captura ausente, antiga ou falha.

`checkEvaluationPreconditions` e `checkDosePreconditions` rejeitam dados obsoletos
apenas sobre os valores fornecidos. O adaptador das levas seguintes deve reler
propriedade, versões, fontes, relações, episódio e controle sob o lock contratado,
validar a época/lease e persistir entrega, referências, recibos e transições na
mesma transação. Replay precisa do recibo original. Retirada/expiração de sinal
não recupera carga nem apaga o limite comprometido.

## Verificação e limites

Os seis `*.spec.ts` contêm fixtures com expectativas numéricas explícitas para
evidência, duração, dose, seleção/calendário, validação e fachada. Rodar Jest com
`--runInBand --silent --runTestsByPath` e os seis caminhos explícitos, seguido de
`npm run build`. Prettier/ESLint devem ficar restritos a este diretório.

Não há transporte, Prisma, migração, persistência, banco, rede ou LLM neste motor.
O único uso de tipos globais é `import type` de `Segment`; a matemática existente
de VDOT é reutilizada, refinando a inversão inteira antes do arredondamento de
política. FIT, watch-plan, projeção legada, UI, testes PostgreSQL/CAS e integração
dos escritores continuam nas levas responsáveis. Os limiares versionados seguem
como política operacional, com calibração científica individual ainda pendente.
