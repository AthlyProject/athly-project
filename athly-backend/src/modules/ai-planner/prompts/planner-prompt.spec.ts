import { buildMacrocycle } from '../periodization';
import { buildAssessmentPrompt, buildPlannerPrompt, type AiPlannerInput } from './planner-prompt';
import type { ParsedGoal } from './goal-parser-prompt';

const input: AiPlannerInput = {
  runSummaries: [],
  avgDistKm: 7.7,
  avgPace: '6:00',
  avgHR: null,
  maxDistKm: 13,
  totalDistKm: 153,
  weekDates: [
    '2026-10-19',
    '2026-10-20',
    '2026-10-21',
    '2026-10-22',
    '2026-10-23',
    '2026-10-24',
    '2026-10-25',
  ],
  trainingDays: 4,
  availableDays: ['tuesday', 'thursday', 'saturday', 'sunday'],
};
const zones = { formatted: '', vdotScore: 33.3 };

const goal = (over: Partial<ParsedGoal>): ParsedGoal => ({
  isRunningRelated: true,
  targetDistance: 'half',
  targetTime: null,
  eventDate: null,
  eventName: null,
  experienceLevel: 'intermediate',
  summary: 'Treinar para meia maratona',
  rejectionReason: null,
  ...over,
});

// Meia no domingo 01/11 com o plano começando na segunda 19/10: semana 0 = taper, 1 = prova.
const macro = buildMacrocycle({
  startMondayISO: '2026-10-19',
  eventDate: '2026-11-01',
  targetDistanceMeters: 21097.5,
  currentWeeklyVolumeKm: 22.7,
  experienceLevel: 'intermediate',
});

// As regras de saída citam "<countdown_logic>" mesmo sem a seção: procure o conteúdo dela.
const COUNTDOWN = 'A meta TEM data programada';
const GOAL_ATTEMPT = 'REGRA DE FEASIBILITY';

const prompt = (g: ParsedGoal, weekIndex: number) =>
  buildPlannerPrompt(input, zones, null, g, null, [], [], macro[weekIndex]);

describe('buildPlannerPrompt — contagem regressiva', () => {
  it('meta com data e sem tempo alvo recebe a contagem regressiva', () => {
    const text = prompt(goal({ eventDate: '2026-11-01' }), 0);
    expect(text).toContain(`${COUNTDOWN}: 2026-11-01.`);
    expect(text).toContain('Faltam 1 semana(s) para a prova.');
    expect(text).toContain('TAPER (afinamento)');
    expect(text).toContain('rumo a completar a prova (half), sem pace alvo');
    expect(text).not.toMatch(/pace alvo \((half|undefined|null)\)/);
  });

  it('semana da prova sem tempo alvo pede a prova completa em esforço controlado', () => {
    const text = prompt(goal({ eventDate: '2026-11-01' }), 1);
    expect(text).toContain('SEMANA DA PROVA');
    expect(text).toContain('main = a prova completa (half) em esforço constante e controlado');
    expect(text).not.toContain('pace alvo (pace alvo)');
  });

  it('meta com tempo alvo mantém o pace alvo', () => {
    const text = prompt(goal({ eventDate: '2026-11-01', targetTime: '2:00:00' }), 0);
    expect(text).toContain('rumo ao pace alvo (half em 2:00:00)');
    const raceWeek = prompt(goal({ eventDate: '2026-11-01', targetTime: '2:00:00' }), 1);
    expect(raceWeek).toContain('main = a tentativa no pace alvo (2:00:00)');
  });

  it('explica o teto reduzido do polimento e o da semana da prova', () => {
    const guarded = (source: 'baseline' | 'taper' | 'race', weekIndex: number) =>
      buildPlannerPrompt(
        input,
        zones,
        null,
        goal({ eventDate: '2026-11-01' }),
        null,
        [],
        [],
        macro[weekIndex],
        undefined,
        {
          weeklyVolumeBaselineKm: 22.7,
          weeklyVolumeMaxKm: 12.54,
          weeklyVolumeMaxSource: source,
          volumeConfidence: 'high',
        },
      );
    expect(guarded('taper', 0)).toContain('segue o POLIMENTO do macrociclo');
    expect(guarded('baseline', 0)).not.toContain('POLIMENTO do macrociclo');
    const raceWeek = guarded('race', 1);
    expect(raceWeek).toContain('JÁ INCLUI a própria prova');
    expect(raceWeek).toContain('km além da prova');
    expect(raceWeek).toMatch(/- Prova: ~21\.1 km/);
  });

  it('na fase BASE explicita os limites do gate', () => {
    const baseMacro = buildMacrocycle({
      startMondayISO: '2026-10-19',
      eventDate: '2026-12-31',
      targetDistanceMeters: 21097.5,
      currentWeeklyVolumeKm: 22.7,
      experienceLevel: 'intermediate',
      recentLongestRunKm: 13,
    });
    const text = buildPlannerPrompt(
      input,
      zones,
      null,
      goal({ eventDate: '2026-12-31' }),
      null,
      [],
      [],
      baseMacro[0],
    );
    expect(baseMacro[0].phase).toBe('base');
    expect(text).toContain('no máximo 1 treino com trecho de trabalho em RPE 7 ou mais');
    expect(text).toContain(`até ~${Math.round(baseMacro[0].longRunKm * 12.5) / 10} km`);
    expect(prompt(goal({ eventDate: '2026-11-01' }), 0)).not.toContain('Limites da BASE');
  });

  it('meta sem data e sem tempo alvo não tem contagem nem tentativa', () => {
    const text = prompt(goal({}), 0);
    expect(text).not.toContain(COUNTDOWN);
    expect(text).not.toContain(GOAL_ATTEMPT);
  });
});

describe('buildAssessmentPrompt — semana sem histórico no Health', () => {
  const text = (days: number) =>
    buildAssessmentPrompt(input.weekDates, days, input.availableDays.slice(0, days), zones);

  it('pede só blocos por tempo, sem tiros e sem pace alvo', () => {
    const t = text(3);
    expect(t).toContain('TODOS os trechos terminam por TEMPO');
    expect(t).toContain('Nenhum trecho passa de RPE 6');
    expect(t).toContain('3 × (5 min em ritmo moderado, RPE 6');
    expect(t).not.toMatch(/6×400m|Limiar Lático|Avaliação de Velocidade/);
    expect(t).not.toContain('distâncias conservadoras');
  });

  it('com 2 dias, faz a rodagem de reconhecimento e os blocos de 5 min', () => {
    const t = text(2);
    expect(t).toContain('1. Rodagem de reconhecimento');
    expect(t).toContain('2. Blocos de 5 min');
    expect(t).not.toContain('3. Rodagem progressiva');
  });
});
