/**
 * Suíte de evals do planner: roda os casos de `casos.ts` pela API local, na mesma ordem de
 * chamadas do app, e julga cada geração com `verificacoes.ts`. Sai com código 1 se algum caso
 * falhar. Resultado em `.cenarios/eval/<carimbo>/` (relatorio.md, resultados.json e uma pasta
 * por caso); `.cenarios/eval/historico.json` guarda o último resultado de cada caso para
 * apontar o que mudou. Uso em `prisma/cenarios/README.md`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CENARIOS,
  SAIDA,
  SENHA,
  emailDe,
  prisma,
  reset,
  salvarGeracao,
  type Cenario,
} from '../base';
import { ONBOARDING, PERFIS_DO_IOS, casos as catalogo, segundaDaSemana, type Caso } from './casos';
import { healthDoIos, historico, type Health } from './health';
import { buscarLog, medir } from './medir';
import { semearPlano, type Persona, type ResumoPlano } from './plano-em-andamento';
import { relatorio, custoDe, type Execucao, type Mudanca, type Status } from './relatorio';
import { verificar, type AnaliseMeta, type FatosTroca } from './verificacoes';

const API = process.env.CENARIOS_API_URL ?? 'http://localhost:4000';
const LIMITE_MS = 8 * 60_000;
/** Custo típico de uma geração (eval de 2026-10-20: US$ 0,01–0,04), para a estimativa. */
const CUSTO_TIPICO_USD = 0.03;

export interface Opcoes {
  perfis: Cenario[] | null;
  tags: string[];
  casos: string[];
  repetir: number;
  maxUsd: number;
  listar: boolean;
}

const AJUDA = `Uso: ./cenarios.sh eval [perfil|todos] [opções]
  --tag a,b        só os casos com alguma dessas tags (ex.: semana-da-prova, onboarding, fc)
  --caso id        só esse caso (ex.: veloz/meia-sub2h-10-semanas); pode repetir
  --repetir N      roda cada caso N vezes, para ver a variação da IA
  --max-usd X      para de começar casos quando o custo passar de X (padrão 2)
  --listar         mostra os casos selecionados e o custo estimado, sem rodar`;

export function lerOpcoes(args: string[]): Opcoes {
  const opcoes: Opcoes = {
    perfis: null,
    tags: [],
    casos: [],
    repetir: 1,
    maxUsd: 2,
    listar: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const valor = () => {
      const v = args[++i];
      if (v === undefined) throw new Error(`Falta o valor de ${arg}.\n\n${AJUDA}`);
      return v;
    };
    if (arg === '--tag') opcoes.tags.push(...valor().split(','));
    else if (arg === '--caso') opcoes.casos.push(valor());
    else if (arg === '--repetir') opcoes.repetir = Math.max(1, Number(valor()) || 1);
    else if (arg === '--max-usd') opcoes.maxUsd = Number(valor());
    else if (arg === '--listar') opcoes.listar = true;
    else if (arg === 'todos') opcoes.perfis = null;
    else if (CENARIOS.includes(arg as Cenario))
      opcoes.perfis = [...(opcoes.perfis ?? []), arg as Cenario];
    else throw new Error(`Opção desconhecida: ${arg}\n\n${AJUDA}`);
  }
  if (!Number.isFinite(opcoes.maxUsd) || opcoes.maxUsd <= 0)
    throw new Error('--max-usd precisa ser um número positivo.');
  return opcoes;
}

function selecionar(todos: Caso[], o: Opcoes): Caso[] {
  const selecionados = todos.filter(
    (c) =>
      (!o.perfis || o.perfis.includes(c.perfil)) &&
      (!o.tags.length || o.tags.some((t) => c.tags.includes(t))) &&
      (!o.casos.length || o.casos.includes(c.id)),
  );
  const desconhecidos = o.casos.filter((id) => !todos.some((c) => c.id === id));
  if (desconhecidos.length) {
    throw new Error(`Caso não encontrado: ${desconhecidos.join(', ')}. Veja a lista com --listar.`);
  }
  return selecionados;
}

function descreverFiltro(o: Opcoes) {
  const partes = [
    o.perfis ? `perfis ${o.perfis.join(', ')}` : '',
    o.tags.length ? `tags ${o.tags.join(', ')}` : '',
    o.casos.length ? `casos ${o.casos.join(', ')}` : '',
    o.repetir > 1 ? `${o.repetir} repetições` : '',
  ].filter(Boolean);
  return partes.length ? partes.join('; ') : 'todos os casos';
}

// MARK: - Execução de um caso

async function api<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${texto.slice(0, 300)}`);
  return (texto ? JSON.parse(texto) : null) as T;
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function rodarCaso(
  caso: Caso,
  repeticao: number,
  healthIos: Partial<Record<Cenario, Health>>,
  pastaEval: string,
  repeticoes: number,
  hoje: Date,
): Promise<Execucao> {
  const { perfil, meta } = caso;
  await reset(perfil, { exportarAntes: false, silencioso: true });
  const { accessToken: token } = await api<{ accessToken: string }>('POST', '/auth/login', {
    email: emailDe(perfil),
    password: SENHA,
  });
  const onboarding = ONBOARDING[perfil];
  // Mesmo corpo do AssessmentView.submit() (campos nil não vão no JSON).
  await api(
    'POST',
    '/assessment',
    {
      motivations: [],
      fitnessLevel: onboarding.fitnessLevel,
      comfortPaceSeconds: onboarding.comfortPaceSeconds,
      objective: 'personal',
      objectiveDistance: meta.objectiveDistance,
      objectiveType: meta.objectiveType,
      targetTime: meta.targetTime,
      eventDate: meta.eventDate,
      availableDays: onboarding.availableDays,
      termsAccepted: true,
    },
    token,
  );

  let health: Health;
  let plano: ResumoPlano | undefined;
  let antesDaTroca: { semanas: number; treinos: number } | undefined;
  const user = await prisma.user.findUniqueOrThrow({ where: { email: emailDe(perfil) } });
  const contarPlano = async () => ({
    semanas: await prisma.weeklyGoal.count({
      where: { trainingPlan: { userId: user.id }, status: 'GENERATED' },
    }),
    treinos: await prisma.workout.count({ where: { userId: user.id } }),
  });
  if (caso.situacao.tipo === 'onboarding') {
    health = healthIos[perfil]!;
  } else {
    ({ health, resumo: plano } = await semearPlano(
      perfil as Persona,
      user.id,
      caso.situacao.semanasAteProva,
      hoje,
    ));
    if (caso.situacao.trocaDeMeta) {
      // Troca de meta no meio do ciclo, como o "Alterar meta" do app.
      antesDaTroca = await contarPlano();
      await api('PUT', '/goals/active', caso.situacao.trocaDeMeta, token);
    }
  }
  const { entrada, fcRepouso } = health;

  // Como o PlannerHealthSyncService.buildInput: envia a FC de repouso e sincroniza o contexto
  // antes de pedir o plano.
  if (fcRepouso) {
    await api(
      'PUT',
      '/users/me/heart-rate-health',
      { ...fcRepouso, capturedAt: new Date().toISOString() },
      token,
    );
  }
  if (entrada.runs.length) {
    await api(
      'POST',
      '/ai-planner/health-context',
      {
        runs: entrada.runs,
        detailedSessions: entrada.detailedSessions,
        runsReadFrom: entrada.runsReadFrom,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        capturedAt: new Date().toISOString(),
      },
      token,
    );
  }
  // Como o app: a análise da meta vem antes da primeira semana, com o mesmo Health.
  const analise =
    caso.situacao.tipo === 'onboarding'
      ? await api<AnaliseMeta>(
          'POST',
          '/ai-planner/goal-analysis',
          { ...entrada, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          token,
        )
      : undefined;
  const inicio = Date.now();
  const { generationId } = await api<{ generationId: string }>(
    'POST',
    '/ai-planner/plan-from-health/async',
    entrada,
    token,
  );
  let geracao: { status: string; error?: string; weeklyGoalId?: string } = { status: '' };
  while (Date.now() - inicio < LIMITE_MS) {
    await esperar(3000);
    geracao = await api(
      'GET',
      `/ai-planner/plan-from-health/generations/${generationId}`,
      undefined,
      token,
    );
    if (geracao.status === 'completed' || geracao.status === 'failed') break;
  }
  const segundos = Math.round((Date.now() - inicio) / 1000);
  if (geracao.status !== 'completed' || !geracao.weeklyGoalId) {
    return {
      caso,
      repeticao,
      status: 'erro',
      segundos,
      plano,
      analise,
      achados: [],
      erro: geracao.error ?? `status "${geracao.status}" após ${segundos}s`,
    };
  }
  const log = await buscarLog(geracao.weeklyGoalId);
  const pasta = await salvarGeracao(log.id, {
    entrada,
    pasta: join(pastaEval, repeticoes > 1 ? `${caso.id}-${repeticao}` : caso.id),
  });
  // O histórico vai até o início da semana gerada (no plano em andamento, a segunda atual).
  const ate = caso.situacao.tipo === 'onboarding' ? new Date() : segundaDaSemana(hoje);
  const medicao = medir(log, caso, historico(entrada, ate));
  let troca: FatosTroca | undefined;
  if (antesDaTroca) {
    const [depois, planoDb, metaAtiva] = await Promise.all([
      contarPlano(),
      prisma.trainingPlan.findUnique({ where: { userId: user.id } }),
      prisma.userGoal.findFirst({ where: { userId: user.id, active: true } }),
    ]);
    troca = {
      planoReligado: Boolean(metaAtiva && planoDb?.userGoalId === metaAtiva.id),
      objetivoDoPlano: planoDb?.objective ?? '—',
      semanasGeradas: depois.semanas,
      semanasAntesDaTroca: antesDaTroca.semanas,
      treinosAntes: antesDaTroca.treinos,
      treinosDepois: depois.treinos,
    };
  }
  const achados = verificar({ caso, m: medicao, plano, hoje, analise, troca });
  const status: Status = achados.some((a) => !a.ok && a.nivel === 'falha')
    ? 'falhou'
    : achados.some((a) => !a.ok)
      ? 'aviso'
      : 'passou';
  return { caso, repeticao, status, segundos, pasta, medicao, plano, analise, troca, achados };
}

// MARK: - Histórico entre execuções

type Historico = Record<string, { status: Status; carimbo: string }>;
const ARQUIVO_HISTORICO = join(SAIDA, 'eval', 'historico.json');

function lerHistorico(): Historico {
  if (!existsSync(ARQUIVO_HISTORICO)) return {};
  try {
    return JSON.parse(readFileSync(ARQUIVO_HISTORICO, 'utf8')) as Historico;
  } catch {
    return {};
  }
}

/** O pior resultado de cada caso nesta execução (com repetições, uma falha basta). */
function piorPorCaso(execucoes: Execucao[]): Map<string, Status> {
  const ordem: Status[] = ['passou', 'aviso', 'falhou', 'erro'];
  const pior = new Map<string, Status>();
  for (const e of execucoes.filter((x) => x.status !== 'não rodou')) {
    const atual = pior.get(e.caso.id);
    if (!atual || ordem.indexOf(e.status) > ordem.indexOf(atual)) pior.set(e.caso.id, e.status);
  }
  return pior;
}

// MARK: - Suíte

export async function rodarEval(opcoes: Opcoes): Promise<boolean> {
  const hoje = new Date();
  const selecionados = selecionar(catalogo(hoje), opcoes);
  const total = selecionados.length * opcoes.repetir;
  const estimativa = total * CUSTO_TIPICO_USD;
  if (!selecionados.length)
    throw new Error(`Nenhum caso com o filtro: ${descreverFiltro(opcoes)}.`);
  if (opcoes.listar) {
    console.log(`${selecionados.length} casos (${descreverFiltro(opcoes)}):\n`);
    for (const c of selecionados) {
      console.log(`  ${c.id.padEnd(42)} ${c.tags.join(', ')}\n  ${''.padEnd(42)} ${c.objetivo}`);
    }
    console.log(`\n${total} gerações, custo estimado ~US$ ${estimativa.toFixed(2)}.`);
    return true;
  }
  if (new Date().getDay() === 0 && selecionados.some((c) => c.tags.includes('semana-da-prova'))) {
    console.log('Aviso: hoje é domingo, então a prova dos casos de semana da prova é hoje.\n');
  }
  try {
    await fetch(API);
  } catch {
    throw new Error(
      `O backend local não respondeu em ${API}. Suba com "npm run start:dev" antes do eval.`,
    );
  }

  const carimbo = hoje.toLocaleString('sv-SE').replace(' ', '_').replace(/:/g, '');
  const pastaEval = join(SAIDA, 'eval', carimbo);
  mkdirSync(pastaEval, { recursive: true });
  const perfisIos = [
    ...new Set(selecionados.filter((c) => c.situacao.tipo === 'onboarding').map((c) => c.perfil)),
  ].filter((p) => PERFIS_DO_IOS.includes(p));
  if (perfisIos.length) console.log('Gerando o Health simulado com o MockHealthKitService do iOS…');
  const healthIos = healthDoIos(perfisIos);
  console.log(
    `${total} gerações (${descreverFiltro(opcoes)}), uma por vez; custo estimado ~US$ ${estimativa.toFixed(2)}, ` +
      `limite US$ ${opcoes.maxUsd.toFixed(2)}.\n`,
  );

  const anterior = lerHistorico();
  const execucoes: Execucao[] = [];
  let gasto = 0;
  const salvar = () => {
    const pior = piorPorCaso(execucoes);
    const mudancas: Mudanca[] = [...pior.entries()]
      .filter(([id, status]) => anterior[id] && anterior[id].status !== status)
      .map(([id, agora]) => ({
        id,
        agora,
        antes: anterior[id].status,
        carimboAnterior: anterior[id].carimbo,
      }));
    writeFileSync(join(pastaEval, 'resultados.json'), JSON.stringify(execucoes, null, 2));
    writeFileSync(
      join(pastaEval, 'relatorio.md'),
      relatorio({
        carimbo,
        execucoes,
        repeticoes: opcoes.repetir,
        filtro: descreverFiltro(opcoes),
        healthIos,
        mudancas,
      }),
    );
    return pior;
  };

  for (const caso of selecionados) {
    for (let repeticao = 1; repeticao <= opcoes.repetir; repeticao++) {
      const rotulo = opcoes.repetir > 1 ? `${caso.id} #${repeticao}` : caso.id;
      if (gasto >= opcoes.maxUsd) {
        execucoes.push({ caso, repeticao, status: 'não rodou', segundos: 0, achados: [] });
        continue;
      }
      process.stdout.write(`[${rotulo}] `);
      let execucao: Execucao;
      try {
        execucao = await rodarCaso(caso, repeticao, healthIos, pastaEval, opcoes.repetir, hoje);
      } catch (error) {
        execucao = {
          caso,
          repeticao,
          status: 'erro',
          segundos: 0,
          achados: [],
          erro: error instanceof Error ? error.message : String(error),
        };
      }
      execucoes.push(execucao);
      gasto += custoDe(execucao);
      const m = execucao.medicao;
      const falhas = execucao.achados.filter((a) => !a.ok);
      console.log(
        m
          ? `${execucao.status}, ${execucao.segundos}s, ${m.viabilidade?.verdict ?? 'sem veredito'}, ` +
              `${m.plano.corridas} treinos ≈${m.plano.km.toFixed(1)} km` +
              (falhas.length ? ` — ${falhas.map((a) => `${a.id} (${a.nivel})`).join(', ')}` : '')
          : `ERRO: ${execucao.erro}`,
      );
      salvar();
    }
  }

  const pior = salvar();
  const novo: Historico = { ...anterior };
  for (const [id, status] of pior) novo[id] = { status, carimbo };
  writeFileSync(ARQUIVO_HISTORICO, JSON.stringify(novo, null, 2));

  const problemas = execucoes.filter((e) => e.status === 'falhou' || e.status === 'erro').length;
  const naoRodaram = execucoes.filter((e) => e.status === 'não rodou').length;
  console.log(
    `\n${execucoes.length - problemas - naoRodaram} de ${execucoes.length} passaram` +
      (naoRodaram
        ? `, ${naoRodaram} não rodaram (limite de US$ ${opcoes.maxUsd.toFixed(2)})`
        : '') +
      `. Custo US$ ${gasto.toFixed(2)}.\nRelatório: ${join(pastaEval, 'relatorio.md')}`,
  );
  return problemas === 0 && naoRodaram === 0;
}
