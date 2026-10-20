/** Relatório em Markdown de uma execução da suíte. */
import type { Cenario } from '../base';
import { ONBOARDING, PERFIS_DO_IOS, type Caso } from './casos';
import { historico, type Health } from './health';
import { DIAS, DIAS_PT, dataBr, hms, minSeg, type Medicao } from './medir';
import type { ResumoPlano } from './plano-em-andamento';
import type { Achado, AnaliseMeta, FatosTroca } from './verificacoes';

export type Status = 'passou' | 'aviso' | 'falhou' | 'erro' | 'não rodou';

export interface Execucao {
  caso: Caso;
  repeticao: number;
  status: Status;
  segundos: number;
  erro?: string;
  pasta?: string;
  medicao?: Medicao;
  plano?: ResumoPlano;
  analise?: AnaliseMeta;
  troca?: FatosTroca;
  achados: Achado[];
}

export interface Mudanca {
  id: string;
  antes: Status;
  agora: Status;
  carimboAnterior: string;
}

const ROTULO: Record<Status, string> = {
  passou: 'passou',
  aviso: 'passou com aviso',
  falhou: '**falhou**',
  erro: '**erro**',
  'não rodou': 'não rodou (limite de custo)',
};

export const custoDe = (e: Execucao) => e.medicao?.custoUsd ?? 0;
const rotuloPerfil = (e: Execucao, repeticoes: number) =>
  repeticoes > 1 ? `${e.caso.perfil} #${e.repeticao}` : e.caso.perfil;
const nome = (e: Execucao, repeticoes: number) =>
  repeticoes > 1 ? `${e.caso.id} #${e.repeticao}` : e.caso.id;

export function relatorio(params: {
  carimbo: string;
  execucoes: Execucao[];
  repeticoes: number;
  filtro: string;
  healthIos: Partial<Record<Cenario, Health>>;
  mudancas: Mudanca[];
}): string {
  const { carimbo, execucoes, repeticoes, filtro, healthIos, mudancas } = params;
  const conta = (s: Status) => execucoes.filter((e) => e.status === s).length;
  const primeiro = execucoes.find((e) => e.medicao)?.medicao;
  const custo = execucoes.reduce((t, e) => t + custoDe(e), 0);
  const casos = new Set(execucoes.map((e) => e.caso.id)).size;
  const linhas: string[] = [
    `# Eval do planner: ${carimbo}`,
    '',
    `Modelo ${primeiro?.modelo ?? '?'}, prompt ${primeiro?.versaoPrompt ?? '?'}. ` +
      `${execucoes.length} execuções de ${casos} casos: ${conta('passou')} passaram, ` +
      `${conta('aviso')} passaram com aviso, ${conta('falhou')} falharam, ${conta('erro')} com erro` +
      (conta('não rodou') ? `, ${conta('não rodou')} não rodaram` : '') +
      `. Custo estimado US$ ${custo.toFixed(2)}, ${Math.round(execucoes.reduce((t, e) => t + e.segundos, 0) / 60)} min de geração.`,
    '',
    `Filtro: ${filtro}. Volumes do plano são estimativas: trechos por tempo sem pace alvo usam o pace de conforto do onboarding.`,
    '',
    '## Resultados por situação',
  ];
  // Uma tabela por meta, com os perfis lado a lado (do menos ao mais condicionado).
  const metas = [...new Map(execucoes.map((e) => [e.caso.meta.id, e.caso.meta])).values()];
  for (const meta of metas) {
    linhas.push(
      '',
      `### ${meta.titulo} (${dataBr(meta.eventDate)})`,
      '',
      '| Perfil | Resultado | Veredito | Resistência para a distância | VDOT atual → necessário | Plano da semana | Geração |',
      '|---|---|---|---|---|---|---|',
      ...execucoes.filter((e) => e.caso.meta.id === meta.id).map((e) => linhaResumo(e, repeticoes)),
    );
  }

  if (repeticoes > 1) {
    linhas.push('', '## Estabilidade', '');
    for (const id of new Set(execucoes.map((e) => e.caso.id))) {
      const doCaso = execucoes.filter((e) => e.caso.id === id && e.status !== 'não rodou');
      const ok = doCaso.filter((e) => e.status === 'passou' || e.status === 'aviso').length;
      const falhas = [
        ...new Set(
          doCaso.flatMap((e) =>
            e.achados.filter((a) => !a.ok && a.nivel === 'falha').map((a) => a.id),
          ),
        ),
      ];
      linhas.push(
        `- \`${id}\`: ${ok} de ${doCaso.length} passaram${falhas.length ? ` (falhas: ${falhas.join(', ')})` : ''}`,
      );
    }
  }

  if (mudancas.length) {
    linhas.push('', '## Mudanças desde a execução anterior de cada caso', '');
    for (const m of mudancas) {
      linhas.push(`- \`${m.id}\`: ${m.antes} → **${m.agora}** (antes: ${m.carimboAnterior})`);
    }
  }

  const comProblema = execucoes.filter(
    (e) => e.status === 'falhou' || e.status === 'aviso' || e.status === 'erro',
  );
  if (comProblema.length) {
    linhas.push('', '## Falhas e avisos');
    for (const e of comProblema) {
      linhas.push('', `### ${nome(e, repeticoes)}: ${ROTULO[e.status]}`, '');
      if (e.erro) linhas.push(`- Erro: ${e.erro}`);
      for (const a of e.achados.filter((x) => !x.ok)) {
        linhas.push(`- **${a.id}** (${a.nivel}): ${a.detalhe}`);
      }
    }
  }

  linhas.push('', '## Perfis', '', '| Perfil | Health enviado | Onboarding |', '|---|---|---|');
  const perfis = [...new Set(execucoes.map((e) => e.caso.perfil))];
  for (const perfil of perfis) {
    const o = ONBOARDING[perfil];
    const dias = o.availableDays.map((d) => DIAS_PT[DIAS.indexOf(d)]).join('/');
    const plano = execucoes.find((e) => e.caso.perfil === perfil && e.plano)?.plano;
    const health = PERFIS_DO_IOS.includes(perfil) ? healthIos[perfil] : undefined;
    linhas.push(
      `| ${perfil} | ${plano ? descreverPlano(plano) : health ? descreverHealth(health) : '—'} | ${o.nivel}, conforto ${minSeg(o.comfortPaceSeconds)}/km, ${dias} |`,
    );
  }

  linhas.push('', '## Casos');
  for (const e of execucoes) casoDetalhado(linhas, e, repeticoes);
  return `${linhas.join('\n')}\n`;
}

function descreverHealth({ entrada, fcRepouso }: Health) {
  const h = historico(entrada);
  if (!h.corridas) return 'nenhuma corrida';
  return (
    `${h.corridas} corridas, ${h.kmSemana.toFixed(1)} km/sem (4 sem), maior ${h.maiorKm} km, ` +
    `pace médio ${minSeg(h.paceMedio!)}/km, ${h.comFc ? 'com FC' : 'sem FC'}, ` +
    `${fcRepouso ? `FC de repouso ${fcRepouso.restingHeartRate} bpm, ` : ''}splits ${h.splits.join(', ') || '—'}`
  );
}

function descreverPlano(p: ResumoPlano) {
  const melhor = p.melhorEsforco
    ? `melhor esforço ${p.melhorEsforco.km} km em ${hms(p.melhorEsforco.segundos)} (VDOT ${p.melhorEsforco.vdot})`
    : 'sem esforço de referência';
  return (
    `Plano de meia desde ${dataBr(p.inicio)}, ${p.semanasFeitas} semanas feitas: ` +
    `${p.feitos} de ${p.prescritos} treinos feitos, ${p.parciais} parciais, ${p.pulados} pulados` +
    (p.avulsas ? `, ${p.avulsas} corridas fora do plano` : '') +
    `; ${(p.kmUltimas4 / 4).toFixed(1)} km/sem nas últimas 4, maior ${p.maiorRecenteKm.toFixed(1)} km; ${melhor}; ` +
    `${p.fonte}, ${p.comFc ? 'com FC' : 'sem FC'}`
  );
}

function linhaResumo(e: Execucao, repeticoes: number): string {
  const m = e.medicao;
  if (!m)
    return `| ${rotuloPerfil(e, repeticoes)} | ${ROTULO[e.status]} | | | | ${e.erro ?? ''} | ${e.segundos}s |`;
  const v = m.viabilidade;
  const falhas = e.achados.filter((a) => !a.ok);
  const resultado =
    ROTULO[e.status] + (falhas.length ? ` (${falhas.map((a) => a.id).join(', ')})` : '');
  return (
    `| ${rotuloPerfil(e, repeticoes)} | ${resultado} | ${v?.verdict ?? '—'}${v?.lowConfidence ? ' (preliminar)' : ''} | ` +
    `${resistencia(m)} | ${v?.currentVdot ?? '—'} → ${v?.requiredVdot ?? '—'} | ` +
    `${m.plano.corridas} treinos, ≈${m.plano.km.toFixed(1)} km, maior ≈${m.plano.longao.toFixed(1)} km | ` +
    `${e.segundos}s, US$ ${(m.custoUsd ?? 0).toFixed(3)} |`
  );
}

/** Resistência para a distância segundo o motor objetivo: do JSON salvo ou do prompt. */
function resistencia(m: Medicao): string {
  const e = m.viabilidade?.assessment?.endurance;
  if (e) {
    const estado = e.state === 'supported' ? 'demonstrada' : 'não demonstrada';
    return `${estado}, maior ${e.longestKm ?? 0}/${e.requiredLongestKm} km (confiança ${m.viabilidade?.assessment?.confidence})`;
  }
  if (!m.prontidao) return '—';
  return m.prontidao.startsWith('demonstrada') ? 'demonstrada' : 'não demonstrada (só no prompt)';
}

function casoDetalhado(linhas: string[], e: Execucao, repeticoes: number) {
  linhas.push(
    '',
    `### ${nome(e, repeticoes)}`,
    '',
    `${e.caso.meta.titulo} (${dataBr(e.caso.meta.eventDate)}). ${e.caso.objetivo}`,
    '',
  );
  const m = e.medicao;
  if (!m) {
    linhas.push(`${ROTULO[e.status]} após ${e.segundos}s${e.erro ? `: ${e.erro}` : ''}`);
    return;
  }
  const a = m.analise;
  const sugestao = m.viabilidade?.suggestion;
  linhas.push(
    '- Verificações:',
    ...e.achados.map(
      (x) =>
        `  - ${x.ok ? 'ok' : x.nivel === 'falha' ? '**FALHA**' : '**aviso**'} ${x.id}: ${x.detalhe}`,
    ),
    `- Geração "${m.tipo}" em ${e.segundos}s, ${m.tokensRaciocinio ?? '?'} tokens de raciocínio, US$ ${(m.custoUsd ?? 0).toFixed(3)}. ` +
      `Prescrição ${m.fc.modo === 'heart_rate_and_rpe' ? 'por FC + RPE' : 'só por RPE'}` +
      (m.fc.zonas.length ? ` (zonas ${m.fc.zonas.join(', ')}).` : '.'),
    `- Volume pedido pelo backend: base ${m.volume.base ?? '—'} km, teto ${m.volume.teto ?? '—'} km` +
      (m.volume.fase
        ? `; macrociclo ${m.volume.fase}, faltam ${m.volume.semanasParaProva ?? '?'} semana(s), alvo ~${m.volume.alvo} km${m.volume.semanaDaProva ? ' além da prova' : ''}, longão/prova ~${m.volume.longao} km.`
        : '; sem macrociclo.'),
    `- Prontidão para a distância (motor objetivo): ${m.prontidao ?? '—'}`,
    ...(e.analise
      ? [
          `- Análise antes do plano: **${e.analise.title}** (${e.analise.verdict ?? 'sem veredito'}). ${e.analise.message}` +
            (e.analise.alternatives.length
              ? ` Alternativas: ${e.analise.alternatives.map((a) => a.summary).join('; ')}.`
              : ' Sem alternativas.'),
        ]
      : []),
    ...(e.caso.situacao.tipo === 'plano-em-andamento' && e.caso.situacao.trocaDeMeta
      ? [`- Troca de meta antes da geração: \`${JSON.stringify(e.caso.situacao.trocaDeMeta)}\``]
      : []),
    ...(sugestao
      ? [
          `- Sugestão: ${[sugestao.realisticTimeSec ? `tempo ${hms(sugestao.realisticTimeSec)}` : '', sugestao.suggestedDate ? `data ${dataBr(sugestao.suggestedDate)}` : ''].filter(Boolean).join(', ')}`,
        ]
      : []),
    `- Viabilidade: \`${JSON.stringify(m.viabilidade)}\``,
    `- Análise da IA: **${a?.title ?? '—'}** (${a?.period ?? '—'}). ${a?.fitnessInsights ?? ''}`,
    `- Arquivos: \`${e.pasta}\``,
    '',
    '| Data | Treino | Int. | ≈km | ≈min | Estrutura |',
    '|---|---|---|---|---|---|',
    ...m.treinos.map(
      (t) =>
        `| ${dataBr(t.data)} ${t.dia} | ${t.tentativa ? '**Prova:** ' : ''}${t.titulo} | ${t.intensidade ?? ''} | ${t.km ? t.km.toFixed(1) : ''} | ` +
        `${t.min ? Math.round(t.min) : ''} | ${t.estrutura.replace(/\|/g, '/')} |`,
    ),
  );
}
