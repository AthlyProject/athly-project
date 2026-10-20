/**
 * Verificações da suíte: cada uma decide se vale para o caso e julga a medição.
 *   falha — o comportamento está errado (o caso falha e o eval sai com código 1)
 *   aviso — vale olhar, mas pode ser variação da IA ou imprecisão da estimativa de volume
 * Os volumes do plano são estimativas do eval (trechos por tempo sem pace usam o pace de conforto),
 * por isso as verificações de volume têm folga.
 */
import {
  parseTargetDistanceMeters,
  parseTargetTimeSeconds,
} from '../../../src/modules/ai-planner/goal-feasibility';
import { ONBOARDING, type Caso } from './casos';
import { minSeg, type Medicao } from './medir';
import type { ResumoPlano } from './plano-em-andamento';

export type Nivel = 'falha' | 'aviso';

export interface Achado {
  id: string;
  nivel: Nivel;
  ok: boolean;
  detalhe: string;
}

/** Resposta de POST /ai-planner/goal-analysis (o que as verificações usam). */
export interface AnaliseMeta {
  applicable?: boolean;
  verdict: string | null;
  hasHistory?: boolean;
  title: string;
  message: string;
  alternatives: {
    id: string;
    axis: string;
    source: string;
    summary: string;
    goal: {
      objectiveDistance: string;
      objectiveType: string;
      targetTime?: string;
      eventDate?: string;
    };
  }[];
}

/** Estado do banco depois de uma troca de meta e da geração da semana. */
export interface FatosTroca {
  planoReligado: boolean;
  objetivoDoPlano: string;
  semanasGeradas: number;
  semanasAntesDaTroca: number;
  treinosAntes: number;
  treinosDepois: number;
}

export interface Contexto {
  caso: Caso;
  m: Medicao;
  plano?: ResumoPlano;
  hoje: Date;
  analise?: AnaliseMeta;
  troca?: FatosTroca;
}

const DISTANCIAS_DE_PROVA: Record<string, number> = {
  '5k': 5000,
  '10k': 10000,
  '15k': 15000,
  half: 21097.5,
  '42k': 42195,
};
const segundos = (tempo?: string) => {
  if (!tempo) return null;
  const partes = tempo.split(':').map(Number);
  return partes.reduce((t, v) => t * 60 + v, 0);
};

interface Verificacao {
  id: string;
  nivel: Nivel;
  descricao: string;
  aplica: (c: Contexto) => boolean;
  avaliar: (c: Contexto) => { ok: boolean; detalhe: string };
}

const fase = (c: Contexto) => c.m.volume.fase ?? '';
const planner = (c: Contexto) => c.m.tipo !== 'assessment';
const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;
const km = (v: number) => `${v.toFixed(1)} km`;
const raceKm = (c: Contexto) =>
  (parseTargetDistanceMeters(c.caso.meta.objectiveDistance) ?? 0) / 1000;
const diasAte = (c: Contexto, iso: string) =>
  Math.round((new Date(`${iso}T12:00:00`).getTime() - c.hoje.getTime()) / 86_400_000);
const somarDiasIso = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const prova = (c: Contexto) => c.m.treinos.filter((t) => t.tentativa);
const resultado = (ok: boolean, detalhe: string) => ({ ok, detalhe });

export const VERIFICACOES: Verificacao[] = [
  {
    id: 'tipo-de-geracao',
    nivel: 'falha',
    descricao: 'Sem corridas no Health gera a semana de avaliação; com corridas, o plano normal.',
    aplica: () => true,
    avaliar: (c) => {
      const esperado = c.m.historico.corridas === 0 ? 'assessment' : 'planner';
      return resultado(c.m.tipo === esperado, `"${c.m.tipo}" (esperado "${esperado}")`);
    },
  },
  {
    id: 'veredito',
    nivel: 'falha',
    descricao: 'Viabilidade gravada com o veredito e a confiança esperados para o perfil.',
    aplica: () => true,
    avaliar: (c) => {
      const v = c.m.viabilidade;
      if (c.caso.vereditos === null) {
        return resultado(
          !v,
          v ? `gravou "${v.verdict}" numa meta sem tempo alvo` : 'nenhuma, como esperado',
        );
      }
      if (!v) return resultado(false, 'nenhuma viabilidade gravada');
      const confianca =
        c.caso.baixaConfianca === undefined || Boolean(v.lowConfidence) === c.caso.baixaConfianca;
      const vereditoOk = c.caso.vereditos.includes(v.verdict);
      return resultado(
        vereditoOk && confianca,
        `${v.verdict}${v.lowConfidence ? ' (preliminar)' : ''}; esperado ${c.caso.vereditos.join(' ou ')}` +
          (c.caso.baixaConfianca !== undefined
            ? c.caso.baixaConfianca
              ? ' (preliminar)'
              : ' (não preliminar)'
            : ''),
      );
    },
  },
  {
    id: 'dias-escolhidos',
    nivel: 'falha',
    descricao: 'Só há treino nos dias que o atleta escolheu.',
    aplica: () => true,
    avaliar: (c) => {
      const dias = ONBOARDING[c.caso.perfil].availableDays;
      const fora = c.m.treinos.filter((t) => t.ativo && !dias.includes(t.diaEn));
      return resultado(
        !fora.length,
        fora.length
          ? fora.map((t) => `${t.data} (${t.dia})`).join(', ')
          : 'todos nos dias escolhidos',
      );
    },
  },
  {
    id: 'nada-depois-da-prova',
    nivel: 'falha',
    descricao: 'Nenhum treino depois da data da prova.',
    aplica: () => true,
    avaliar: (c) => {
      const depois = c.m.treinos.filter((t) => t.ativo && t.data > c.caso.meta.eventDate);
      return resultado(
        !depois.length,
        depois.length ? depois.map((t) => t.data).join(', ') : 'nenhum',
      );
    },
  },
  {
    id: 'fc',
    nivel: 'falha',
    descricao:
      'Modo FC: zona em todo trecho que pede, nenhuma em tiro curto ou recuperação, zona coerente com o RPE. Modo RPE: nenhuma meta de FC.',
    aplica: () => true,
    avaliar: (c) => {
      const f = c.m.fc;
      if (c.m.promptSemFc) {
        return resultado(
          !f.mencaoSemFc.length,
          f.mencaoSemFc.length
            ? `meta de FC sem dados de FC: ${f.mencaoSemFc.join('; ')}`
            : 'modo RPE, sem FC',
        );
      }
      const problemas = [
        ...(f.comZona < f.ativos
          ? [`${f.ativos - f.comZona} de ${f.ativos} trechos sem zona`]
          : []),
        ...f.zonaEmTrechoCurto.map((x) => `zona em tiro curto ou recuperação: ${x}`),
        ...f.zonaIncoerente.map((x) => `zona incoerente: ${x}`),
      ];
      return resultado(
        !problemas.length,
        problemas.length ? problemas.join('; ') : `${f.comZona} de ${f.ativos} trechos com zona`,
      );
    },
  },
  {
    id: 'protocolo-de-avaliacao',
    nivel: 'falha',
    descricao:
      'Semana de avaliação: tudo por tempo, sem pace alvo, RPE até 6, blocos de 5 min ou mais.',
    aplica: (c) => c.m.tipo === 'assessment',
    avaliar: (c) => {
      const problemas: string[] = [];
      for (const t of c.m.treinos.filter((x) => x.ativo)) {
        for (const s of t.trechos) {
          if (s.por !== 'durationSec') problemas.push(`${t.data}: trecho ${s.tipo} por ${s.por}`);
          if (s.paceMin != null || s.paceMax != null) problemas.push(`${t.data}: pace prescrito`);
          if ((s.rpe ?? 0) > 6) problemas.push(`${t.data}: RPE ${s.rpe}`);
          if (s.tipo === 'work' && s.por === 'durationSec' && (s.valor ?? 0) < 300)
            problemas.push(`${t.data}: bloco de ${s.valor}s`);
        }
      }
      return resultado(
        !problemas.length,
        problemas.length ? problemas.join('; ') : `${c.m.plano.corridas} sessões no protocolo`,
      );
    },
  },
  {
    id: 'teto-de-volume',
    nivel: 'aviso',
    descricao: 'Volume do plano até o teto da semana (folga de 10% pela estimativa).',
    aplica: (c) => planner(c) && c.m.volume.teto != null,
    avaliar: (c) => {
      const teto = c.m.volume.teto!;
      return resultado(
        c.m.plano.km <= teto * 1.1,
        `≈${km(c.m.plano.km)} para teto de ${km(teto)} (${pct(c.m.plano.km, teto)})`,
      );
    },
  },
  {
    id: 'piso-de-volume',
    nivel: 'falha',
    descricao: 'Fora do polimento, o volume do plano chega a 80% do alvo da fase.',
    aplica: (c) => planner(c) && /^(BASE|BUILD|PEAK)/.test(fase(c)) && c.m.volume.alvo != null,
    avaliar: (c) => {
      const alvo = c.m.volume.alvo!;
      return resultado(
        c.m.plano.km >= alvo * 0.8,
        `≈${km(c.m.plano.km)} para alvo de ${km(alvo)} (${pct(c.m.plano.km, alvo)})`,
      );
    },
  },
  {
    id: 'longao-da-fase',
    nivel: 'aviso',
    descricao: 'Maior treino da semana entre 75% e 130% do longão de referência.',
    aplica: (c) => planner(c) && !c.m.volume.semanaDaProva && c.m.volume.longao != null,
    avaliar: (c) => {
      const ref = c.m.volume.longao!;
      const l = c.m.plano.longao;
      return resultado(
        l >= ref * 0.75 && l <= ref * 1.3,
        `maior ≈${km(l)} para referência de ${km(ref)} (${pct(l, ref)})`,
      );
    },
  },
  {
    id: 'limites-da-base',
    nivel: 'falha',
    descricao:
      'Fase BASE: no máximo 1 treino com trabalho em RPE 7+ e maior treino até ~1,25 × o longão.',
    aplica: (c) => planner(c) && fase(c).startsWith('BASE') && c.m.volume.longao != null,
    avaliar: (c) => {
      const fortes = c.m.treinos.filter((t) => t.ativo && t.rpeTrabalhoMax >= 7);
      const ref = c.m.volume.longao!;
      // 1,3 em vez de 1,25: folga pela estimativa de volume do eval.
      const ok = fortes.length <= 1 && c.m.plano.longao <= ref * 1.3;
      return resultado(
        ok,
        `${fortes.length} treino(s) em RPE 7+; maior ≈${km(c.m.plano.longao)} para limite de ${km(ref * 1.25)}`,
      );
    },
  },
  // As três seguintes comparam com o histórico real do atleta, sem passar pelos números do
  // backend: pegam o plano exagerado mesmo quando o próprio alvo do backend está errado.
  {
    id: 'volume-vs-historico',
    nivel: 'aviso',
    descricao: 'Volume do plano até 1,3 × a média semanal das últimas 4 semanas.',
    aplica: (c) => planner(c) && c.m.historico.kmSemana > 0 && !c.m.volume.semanaDaProva,
    avaliar: (c) => {
      const recente = c.m.historico.kmSemana;
      return resultado(
        c.m.plano.km <= recente * 1.3,
        `≈${km(c.m.plano.km)} contra ${km(recente)}/sem recentes (${pct(c.m.plano.km, recente)})`,
      );
    },
  },
  {
    id: 'longao-vs-historico',
    nivel: 'aviso',
    descricao: 'Maior treino até 1,25 × a maior corrida das últimas 4 semanas.',
    aplica: (c) => planner(c) && c.m.historico.maiorKm > 0 && !c.m.volume.semanaDaProva,
    avaliar: (c) => {
      const recente = c.m.historico.maiorKm;
      return resultado(
        c.m.plano.longao <= recente * 1.25,
        `maior ≈${km(c.m.plano.longao)} contra ${km(recente)} recentes (${pct(c.m.plano.longao, recente)})`,
      );
    },
  },
  {
    id: 'sem-historico',
    nivel: 'aviso',
    descricao: 'Sem corridas no Health: nenhum treino passa de ~5 km.',
    aplica: (c) => c.m.historico.corridas === 0,
    avaliar: (c) => resultado(c.m.plano.longao <= 5, `maior treino ≈${km(c.m.plano.longao)}`),
  },
  {
    id: 'referencia-do-longao',
    nivel: 'falha',
    descricao:
      'Plano em andamento: a referência do longão acompanha o maior longão das últimas 4 semanas.',
    // Numa troca para prova mais curta, um longão abaixo do maior recente é o esperado.
    aplica: (c) =>
      Boolean(c.plano) && !c.troca && !c.m.volume.semanaDaProva && c.m.volume.longao != null,
    avaliar: (c) => {
      const ref = c.m.volume.longao!;
      const recente = c.plano!.maiorRecenteKm;
      return resultado(
        ref >= recente * 0.9,
        `referência ${km(ref)}; maior das últimas 4 semanas ${km(recente)}`,
      );
    },
  },
  {
    id: 'aviso-de-prontidao',
    nivel: 'aviso',
    descricao: 'Prova a até 4 semanas sem resistência demonstrada: a análise da IA avisa.',
    aplica: (c) =>
      (c.m.prontidao ?? '').startsWith('NÃO') && diasAte(c, c.caso.meta.eventDate) <= 28,
    avaliar: (c) => {
      const texto = `${c.m.analise?.title ?? ''} ${c.m.analise?.fitnessInsights ?? ''}`;
      const ok = /resist[êe]ncia|demonstrad|complet|segur|conservador|caminhad|cautel/i.test(texto);
      return resultado(
        ok,
        ok ? 'a análise menciona a prontidão' : `a análise não menciona: "${texto.slice(0, 160)}"`,
      );
    },
  },
  {
    id: 'prova-marcada',
    nivel: 'falha',
    descricao:
      'Semana da prova: exatamente uma tentativa, no dia da prova, com a distância inteira.',
    aplica: (c) => c.m.volume.semanaDaProva,
    avaliar: (c) => {
      const p = prova(c);
      const distancia = raceKm(c);
      if (p.length !== 1) return resultado(false, `${p.length} treinos marcados como tentativa`);
      const t = p[0];
      const ok = t.data === c.caso.meta.eventDate && t.km >= distancia * 0.99;
      return resultado(
        ok,
        `${t.data} "${t.titulo}", ≈${km(t.km)} (prova de ${km(distancia)} em ${c.caso.meta.eventDate})`,
      );
    },
  },
  {
    id: 'vespera-leve',
    nivel: 'falha',
    descricao:
      'Semana da prova: antevéspera até RPE 4; véspera em descanso ou ativação curta (até ~35 min, RPE até 6, ~1 km forte).',
    aplica: (c) => c.m.volume.semanaDaProva,
    avaliar: (c) => {
      const antevespera = somarDiasIso(c.caso.meta.eventDate, -2);
      const vespera = somarDiasIso(c.caso.meta.eventDate, -1);
      const problemas: string[] = [];
      const dias: string[] = [];
      for (const t of c.m.treinos.filter(
        (x) => x.ativo && (x.data === antevespera || x.data === vespera),
      )) {
        dias.push(
          `${t.data} "${t.titulo}" ≈${Math.round(t.min)} min, RPE ${t.rpeMax}, ${km(t.kmForte)} acima de RPE 4`,
        );
        if (t.data === antevespera && (t.rpeMax ?? 0) > 4)
          problemas.push('antevéspera acima de RPE 4');
        if (t.data === vespera && ((t.rpeMax ?? 0) > 6 || t.min > 35 || t.kmForte > 1.5)) {
          problemas.push('véspera além de uma ativação curta');
        }
      }
      return resultado(!problemas.length, [...problemas, ...dias].join('; ') || 'descanso');
    },
  },
  {
    id: 'resto-da-semana-leve',
    nivel: 'aviso',
    descricao: 'Semana da prova: fora a prova, volume até ~1,3 × o alvo e nada em RPE 8+.',
    aplica: (c) => c.m.volume.semanaDaProva && c.m.volume.alvo != null,
    avaliar: (c) => {
      const outros = c.m.treinos.filter((t) => t.ativo && !t.tentativa);
      const volume = outros.reduce((s, t) => s + t.km, 0);
      const alvo = c.m.volume.alvo!;
      const fortes = outros.filter((t) => (t.rpeMax ?? 0) >= 8);
      return resultado(
        volume <= alvo * 1.3 && !fortes.length,
        `≈${km(volume)} além da prova para alvo de ${km(alvo)}` +
          (fortes.length ? `; RPE 8+ em ${fortes.map((t) => t.data).join(', ')}` : ''),
      );
    },
  },
  {
    id: 'pace-da-prova',
    nivel: 'aviso',
    descricao:
      'Meta com tempo: o pace da prova fica entre 3% mais rápido e 8% mais lento que o pace alvo.',
    aplica: (c) => c.m.volume.semanaDaProva && Boolean(c.caso.meta.targetTime),
    avaliar: (c) => {
      const alvo = parseTargetTimeSeconds(c.caso.meta.targetTime) ?? 0;
      const paceMeta = alvo / raceKm(c);
      const t = prova(c)[0];
      const principal = t?.trechos.find(
        (s) => s.tipo === 'work' && (s.paceMin != null || s.paceMax != null),
      );
      if (!principal) return resultado(false, 'a prova não tem pace alvo');
      const meio =
        ((principal.paceMin ?? principal.paceMax!) + (principal.paceMax ?? principal.paceMin!)) / 2;
      return resultado(
        meio >= paceMeta * 0.97 && meio <= paceMeta * 1.08,
        `${minSeg(principal.paceMin ?? meio)}–${minSeg(principal.paceMax ?? meio)}/km para meta de ${minSeg(paceMeta)}/km`,
      );
    },
  },
  {
    id: 'estrategia-conservadora',
    nivel: 'aviso',
    descricao:
      'Semana da prova sem prontidão confirmada: a prova ou a análise pede ritmo controlado.',
    aplica: (c) =>
      c.m.volume.semanaDaProva &&
      ['feasible', 'ambitious', 'unrealistic'].includes(c.m.viabilidade?.verdict),
    avaliar: (c) => {
      const texto = [c.m.analise?.fitnessInsights ?? '', ...prova(c).map((t) => t.texto)].join(' ');
      const ok =
        /conservador|controlad|cautel|segur|caminhad|negativ|segunda metade|sem forçar|início (mais )?(lento|leve)/i.test(
          texto,
        );
      return resultado(ok, ok ? 'pede ritmo controlado' : 'não menciona estratégia conservadora');
    },
  },
];

VERIFICACOES.push(
  {
    id: 'analise-coerente',
    nivel: 'aviso',
    descricao: 'O veredito da análise antes do plano é o mesmo que a geração grava depois.',
    aplica: (c) => Boolean(c.analise?.verdict) && Boolean(c.m.viabilidade?.verdict),
    avaliar: (c) =>
      resultado(
        c.analise!.verdict === c.m.viabilidade!.verdict,
        `análise ${c.analise!.verdict}; gravado depois ${c.m.viabilidade!.verdict}`,
      ),
  },
  {
    id: 'alternativas-na-mesma-data',
    nivel: 'falha',
    descricao:
      'Alternativas na mesma data da meta, só em distâncias de prova até a da meta, tempos em 30 s, no máximo 3.',
    aplica: (c) => Boolean(c.analise),
    avaliar: (c) => {
      const alternativas = c.analise!.alternatives;
      const meta = DISTANCIAS_DE_PROVA[c.caso.meta.objectiveDistance] ?? Infinity;
      const problemas = [
        ...(alternativas.length > 3 ? [`${alternativas.length} alternativas`] : []),
        ...alternativas.flatMap((a) => {
          const distancia = DISTANCIAS_DE_PROVA[a.goal.objectiveDistance];
          const tempo = segundos(a.goal.targetTime);
          return [
            ...(a.goal.eventDate !== c.caso.meta.eventDate ? [`${a.summary}: outra data`] : []),
            ...(distancia === undefined || distancia > meta ? [`${a.summary}: distância`] : []),
            ...(tempo !== null && tempo % 30 !== 0 ? [`${a.summary}: tempo fora de 30 s`] : []),
          ];
        }),
      ];
      return resultado(
        !problemas.length,
        problemas.length
          ? problemas.join('; ')
          : alternativas.map((a) => a.summary).join('; ') || 'nenhuma alternativa',
      );
    },
  },
  {
    id: 'sem-alternativa-sem-dados',
    nivel: 'falha',
    descricao: 'Sem corridas, ou com a meta já pronta, a análise não sugere alternativa.',
    aplica: (c) =>
      Boolean(c.analise) && (c.analise!.hasHistory === false || c.analise!.verdict === 'ready'),
    avaliar: (c) =>
      resultado(
        c.analise!.alternatives.length === 0,
        c.analise!.alternatives.map((a) => a.summary).join('; ') || 'nenhuma',
      ),
  },
  {
    id: 'troca-fase-reancorada',
    nivel: 'falha',
    descricao: 'Troca de meta: o macrociclo recomeça na semana da troca (fase de base).',
    aplica: (c) => Boolean(c.troca),
    avaliar: (c) => resultado(fase(c).startsWith('BASE'), `fase ${fase(c) || '—'}`),
  },
  {
    id: 'troca-semanas-preservadas',
    nivel: 'falha',
    descricao:
      'Troca de meta: as semanas já entregues e seus treinos ficam; só a semana nova é gerada.',
    aplica: (c) => Boolean(c.troca),
    avaliar: (c) => {
      const t = c.troca!;
      return resultado(
        t.semanasGeradas === t.semanasAntesDaTroca + 1 && t.treinosDepois >= t.treinosAntes,
        `${t.semanasGeradas} semanas geradas (antes ${t.semanasAntesDaTroca}); treinos ${t.treinosAntes} → ${t.treinosDepois}`,
      );
    },
  },
  {
    id: 'troca-plano-religado',
    nivel: 'falha',
    descricao: 'Troca de meta: o plano aponta para a meta nova.',
    aplica: (c) => Boolean(c.troca),
    avaliar: (c) =>
      resultado(c.troca!.planoReligado, `objetivo do plano: ${c.troca!.objetivoDoPlano}`),
  },
);

export function verificar(c: Contexto): Achado[] {
  return VERIFICACOES.filter((v) => v.aplica(c)).map((v) => ({
    id: v.id,
    nivel: v.nivel,
    ...v.avaliar(c),
  }));
}
