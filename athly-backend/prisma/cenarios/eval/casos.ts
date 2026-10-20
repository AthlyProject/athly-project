/**
 * Catálogo da suíte: cada caso é uma situação de geração com o que se espera dela, como um
 * teste. As verificações que valem para cada caso ficam em `verificacoes.ts`.
 *
 * Duas situações:
 *   onboarding          — o primeiro plano logo depois do onboarding, com o Health do
 *                         MockHealthKitService do iOS (o mesmo do simulador)
 *   plano-em-andamento  — uma semana do meio ou do fim de um plano, com as semanas anteriores
 *                         semeadas no banco (ver `plano-em-andamento.ts`)
 *
 * As datas são relativas a hoje (domingos de semanas futuras), para os vereditos esperados não
 * mudarem conforme o calendário anda.
 */
import type { FeasibilityVerdict } from '../../../src/modules/ai-planner/goal-feasibility';
import type { Cenario } from '../base';

export interface Onboarding {
  nivel: string;
  fitnessLevel: string;
  comfortPaceSeconds: number;
  availableDays: string[];
}

/** Respostas fixas de cada perfil no onboarding: entre os casos de um perfil, só a meta muda. */
export const ONBOARDING: Record<Cenario, Onboarding> = {
  vazio: {
    nivel: 'Começando (nunca corri de forma consistente)',
    fitnessLevel: 'beginning',
    comfortPaceSeconds: 450,
    availableDays: ['monday', 'wednesday', 'friday'],
  },
  gps: {
    nivel: 'Iniciante (consigo correr até 5 km)',
    fitnessLevel: 'beginner',
    comfortPaceSeconds: 430,
    availableDays: ['tuesday', 'thursday', 'saturday'],
  },
  resumo: {
    nivel: 'Hobby (corro 10 km sem problema)',
    fitnessLevel: 'hobby',
    comfortPaceSeconds: 360,
    availableDays: ['tuesday', 'thursday', 'saturday', 'sunday'],
  },
  medio: {
    nivel: 'Intermediário (participo de provas com preparação)',
    fitnessLevel: 'intermediate',
    comfortPaceSeconds: 335,
    availableDays: ['monday', 'wednesday', 'friday', 'sunday'],
  },
  veloz: {
    nivel: 'Avançado (treino estruturado, meia-maratona+)',
    fitnessLevel: 'advanced',
    comfortPaceSeconds: 295,
    availableDays: ['monday', 'tuesday', 'thursday', 'saturday', 'sunday'],
  },
  disciplinado: {
    nivel: 'Intermediário (participo de provas com preparação)',
    fitnessLevel: 'intermediate',
    comfortPaceSeconds: 360,
    availableDays: ['tuesday', 'thursday', 'saturday', 'sunday'],
  },
  irregular: {
    nivel: 'Hobby (corro 10 km sem problema)',
    fitnessLevel: 'hobby',
    comfortPaceSeconds: 390,
    availableDays: ['tuesday', 'thursday', 'saturday', 'sunday'],
  },
};

/** Perfis cujo Health vem do MockHealthKitService do iOS. */
export const PERFIS_DO_IOS: Cenario[] = ['vazio', 'gps', 'resumo', 'medio', 'veloz'];

export interface Meta {
  id: string;
  titulo: string;
  objectiveDistance: string;
  objectiveType: 'target_time' | 'workload';
  targetTime?: string;
  eventDate: string;
}

export type Situacao =
  | { tipo: 'onboarding' }
  /** Semanas que faltam até a semana da prova: 0 = esta semana é a da prova. */
  | { tipo: 'plano-em-andamento'; semanasAteProva: number; trocaDeMeta?: TrocaDeMeta };

/** Meta nova aceita no meio do ciclo (corpo de PUT /goals/active), antes de gerar a semana. */
export interface TrocaDeMeta {
  objectiveDistance: string;
  objectiveType: 'target_time' | 'workload';
  targetTime?: string;
  eventDate: string;
}

export interface Caso {
  /** `perfil/meta`: o que se passa em `--caso`. */
  id: string;
  perfil: Cenario;
  meta: Meta;
  situacao: Situacao;
  tags: string[];
  /** Por que o caso existe, em uma linha. */
  objetivo: string;
  /** Vereditos aceitos na viabilidade gravada; null = a meta não grava viabilidade. */
  vereditos: FeasibilityVerdict[] | null;
  /** Se a viabilidade deve vir marcada como estimativa preliminar. */
  baixaConfianca?: boolean;
}

export const civil = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Segunda-feira da semana de `data` (semanas de segunda a domingo), à meia-noite local. */
export function segundaDaSemana(data: Date): Date {
  const diasDesdeSegunda = (data.getDay() + 6) % 7;
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() - diasDesdeSegunda);
}

export const somarDias = (data: Date, dias: number) =>
  new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);

/** Domingo da semana atual + `semanas`, o dia típico de prova. */
const domingo = (hoje: Date, semanas: number) =>
  civil(somarDias(segundaDaSemana(hoje), 6 + 7 * semanas));

export function metas(hoje = new Date()) {
  const meiaSub2h = {
    objectiveDistance: 'half',
    objectiveType: 'target_time',
    targetTime: '2:00:00',
  } as const;
  return {
    meia: {
      ...meiaSub2h,
      id: 'meia-sub2h-10-semanas',
      titulo: '21 km abaixo de 2h em 10 semanas',
      eventDate: domingo(hoje, 10),
    },
    cincoK: {
      id: '5k-sub25-6-semanas',
      titulo: '5 km abaixo de 25 min em 6 semanas',
      objectiveDistance: '5k',
      objectiveType: 'target_time',
      targetTime: '25:00',
      eventDate: domingo(hoje, 6),
    },
    meiaProxima: {
      id: 'meia-semana-que-vem',
      titulo: '21 km na semana que vem, sem tempo alvo',
      objectiveDistance: 'half',
      objectiveType: 'workload',
      eventDate: domingo(hoje, 1),
    },
    semanaDaProva: {
      ...meiaSub2h,
      id: 'semana-da-prova',
      titulo: '21 km abaixo de 2h neste domingo (semana da prova)',
      eventDate: domingo(hoje, 0),
    },
    construcao: {
      ...meiaSub2h,
      id: 'semana-de-construcao',
      titulo: '21 km abaixo de 2h em 6 semanas (plano na fase de construção)',
      eventDate: domingo(hoje, 6),
    },
  } satisfies Record<string, Meta>;
}

/** Vereditos de referência do primeiro plano (eval de 2026-10-20), por perfil e meta. */
const VEREDITOS_ONBOARDING: Record<
  string,
  {
    meia: FeasibilityVerdict;
    cincoK: FeasibilityVerdict;
    baixaConfiancaMeia: boolean;
    baixaConfianca5k: boolean;
  }
> = {
  vazio: {
    meia: 'unrealistic',
    cincoK: 'unrealistic',
    baixaConfiancaMeia: true,
    baixaConfianca5k: true,
  },
  gps: {
    meia: 'unrealistic',
    cincoK: 'unrealistic',
    baixaConfiancaMeia: true,
    baixaConfianca5k: false,
  },
  resumo: {
    meia: 'unrealistic',
    cincoK: 'unrealistic',
    baixaConfiancaMeia: false,
    baixaConfianca5k: false,
  },
  medio: { meia: 'feasible', cincoK: 'ready', baixaConfiancaMeia: false, baixaConfianca5k: false },
  veloz: { meia: 'ready', cincoK: 'ready', baixaConfiancaMeia: false, baixaConfianca5k: false },
};

export function casos(hoje = new Date()): Caso[] {
  const m = metas(hoje);
  const lista: Caso[] = [];
  for (const perfil of PERFIS_DO_IOS) {
    const v = VEREDITOS_ONBOARDING[perfil];
    const extras = [
      ...(perfil === 'vazio' ? ['avaliacao'] : []),
      ...(perfil === 'medio' ? ['fc'] : []),
    ];
    lista.push(
      {
        id: `${perfil}/${m.meia.id}`,
        perfil,
        meta: m.meia,
        situacao: { tipo: 'onboarding' },
        tags: ['onboarding', 'meia', ...extras],
        objetivo: 'Primeiro plano para uma meia com tempo alvo, na fase de base.',
        vereditos: [v.meia],
        baixaConfianca: v.baixaConfiancaMeia,
      },
      {
        id: `${perfil}/${m.cincoK.id}`,
        perfil,
        meta: m.cincoK,
        situacao: { tipo: 'onboarding' },
        tags: ['onboarding', '5k', ...extras],
        objetivo: 'Primeiro plano para 5 km com tempo alvo.',
        vereditos: [v.cincoK],
        baixaConfianca: v.baixaConfianca5k,
      },
      {
        id: `${perfil}/${m.meiaProxima.id}`,
        perfil,
        meta: m.meiaProxima,
        situacao: { tipo: 'onboarding' },
        tags: ['onboarding', 'prova-proxima', ...extras],
        objetivo: 'Meia sem tempo alvo a 12 dias: polimento curto e aviso de prontidão.',
        // Metas sem tempo alvo não gravam viabilidade (os apps publicados exigem o tempo).
        vereditos: null,
      },
    );
  }
  lista.push(
    {
      id: `disciplinado/${m.semanaDaProva.id}`,
      perfil: 'disciplinado',
      meta: m.semanaDaProva,
      situacao: { tipo: 'plano-em-andamento', semanasAteProva: 0 },
      tags: ['plano-em-andamento', 'semana-da-prova', 'fc'],
      objetivo:
        'Cumpriu o plano inteiro e chega pronto: a semana da prova tem a tentativa no pace alvo e o resto leve.',
      vereditos: ['ready'],
      baixaConfianca: false,
    },
    {
      id: `irregular/${m.semanaDaProva.id}`,
      perfil: 'irregular',
      meta: m.semanaDaProva,
      situacao: { tipo: 'plano-em-andamento', semanasAteProva: 0 },
      tags: ['plano-em-andamento', 'semana-da-prova'],
      objetivo:
        'Fez ~60% do plano e está no limite da meta: a semana da prova é leve e a estratégia, conservadora.',
      vereditos: ['feasible', 'ambitious'],
      baixaConfianca: false,
    },
    {
      id: `disciplinado/troca-de-meta`,
      perfil: 'disciplinado',
      meta: m.construcao,
      situacao: {
        tipo: 'plano-em-andamento',
        semanasAteProva: 6,
        trocaDeMeta: {
          objectiveDistance: '10k',
          objectiveType: 'target_time',
          targetTime: '50:00',
          eventDate: m.construcao.eventDate,
        },
      },
      tags: ['plano-em-andamento', 'troca-de-meta', 'fc'],
      objetivo:
        'Troca a meia por um 10 km na mesma data, no meio do ciclo: o macrociclo recomeça nesta semana e as semanas entregues ficam.',
      vereditos: ['ready', 'feasible', 'ambitious', 'unrealistic'],
      baixaConfianca: false,
    },
    {
      id: `disciplinado/${m.construcao.id}`,
      perfil: 'disciplinado',
      meta: m.construcao,
      situacao: { tipo: 'plano-em-andamento', semanasAteProva: 6 },
      tags: ['plano-em-andamento', 'construcao', 'fc'],
      objetivo:
        'Semana do meio do plano: a referência do longão acompanha o que o atleta já correu.',
      vereditos: ['ready', 'feasible'],
      baixaConfianca: false,
    },
  );
  return lista;
}
