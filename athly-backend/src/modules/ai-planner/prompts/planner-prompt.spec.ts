import type { PlanLanguage } from '../../../common/i18n/user-language';
import type { AiPlannerInput } from '../types/planner.types';
import { buildAssessmentPrompt, buildPlannerPrompt } from './planner-prompt';

const input: AiPlannerInput = {
  runSummaries: [
    {
      index: 1,
      name: 'Run',
      date: '2026-10-23',
      distanceKm: 5,
      durationMin: 30,
      avgPace: '6:00',
      avgHR: null,
      elevationGain: null,
    },
  ],
  avgDistKm: 5,
  avgPace: '6:00',
  avgHR: null,
  maxDistKm: 5,
  totalDistKm: 5,
  weekDates: [
    '2026-10-26',
    '2026-10-27',
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
    '2026-10-31',
    '2026-11-01',
  ],
  trainingDays: 3,
  availableDays: ['monday', 'wednesday', 'friday'],
};
const zones = { formatted: '<effort_zones>Easy: 6:00–7:00/km</effort_zones>', vdotScore: 40 };
const builders = {
  planner: (language: PlanLanguage) => buildPlannerPrompt(input, zones, language),
  assessment: (language: PlanLanguage) =>
    buildAssessmentPrompt(
      input.weekDates,
      input.trainingDays,
      input.availableDays,
      zones,
      language,
    ),
};

describe.each(Object.entries(builders))('%s prompt language', (_kind, build) => {
  it.each([
    ['en', 'English', 'Base Week', '400m hard', 'Warm-up', 'Complete rest'],
    [
      'de',
      'German (Deutsch)',
      'Woche des Grundlagentrainings',
      '400m schnell',
      'Aufwärmen',
      'Vollständige Ruhe',
    ],
  ] as const)(
    'requests %s throughout user-visible output examples',
    (language, name, title, label, warmup, rest) => {
      const prompt = build(language);
      expect(prompt).toContain(`MANDATORY: write ALL user-visible text in ${name}.`);
      expect(prompt).not.toMatch(/Português|Portuguese|pt-BR|em português/i);
      expect(prompt).toContain(title);
      for (const translated of [label, warmup, rest]) {
        expect(prompt).toContain(`"label": "${translated}"`);
      }
      expect(prompt).not.toMatch(
        /Avaliação Inicial|Semana de Base|Progressão de Volume|400m forte|Sem dados/,
      );
      expect(prompt).not.toMatch(
        /"label": "(?:Aquecimento|Recuperação|Volta à calma|Corrida fácil|Descanso completo)"/,
      );
      expect(prompt).toContain('label, exercise names, fitnessInsights, reasoning and period');
      expect(prompt).toContain(
        'JSON keys, enums, numeric fields, dates (YYYY-MM-DD) and pace formats (M:SS/km) stay exactly as specified.',
      );
    },
  );

  it('retains Brazilian Portuguese examples and requests pt-BR explicitly', () => {
    const prompt = build('pt-BR');
    expect(prompt).toContain(
      'MANDATORY: write ALL user-visible text in Brazilian Portuguese (pt-BR).',
    );
    expect(prompt).toContain('Semana de Base');
    expect(prompt).toContain('"label": "400m forte"');
    expect(prompt).toContain('"label": "Aquecimento"');
    expect(prompt).toContain('"label": "Descanso completo"');
  });

  it('keeps the same recipe structure, numeric targets, enums and training rules across languages', () => {
    const recipeWithoutLabels = (prompt: string) =>
      prompt
        .match(/<segment_recipes>([\s\S]*?)<\/segment_recipes>/)![1]
        .replace(/"label": "[^"]*"/g, '"label": "<translated>"');
    const reference = recipeWithoutLabels(build('pt-BR'));
    for (const language of ['pt-BR', 'en', 'de'] as const) {
      const prompt = build(language);
      expect(recipeWithoutLabels(prompt)).toBe(reference);
      expect(prompt).toContain('"kind": "<warmup|work|recovery|cooldown|rest|set>"');
      expect(prompt).toContain('"sportType": "<running|walking|other>"');
      expect(prompt).toContain(
        '"dayOfWeek": "<Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday>"',
      );
      expect(prompt).toContain('2026-10-26');
      expect(prompt).toContain('2026-11-01');
      expect(prompt).toContain('Segunda, Quarta, Sexta');
      expect(prompt).toContain(zones.formatted);
      expect(prompt).toContain('Siga training_guidance');
    }
  });
});

it.each([
  ['pt-BR', 'Sem dados', 'Avaliação Inicial'],
  ['en', 'No data', 'Initial Assessment'],
  ['de', 'Keine Daten', 'Erste Leistungsbewertung'],
] as const)(
  'localizes the assessment title and period in %s without changing baseline metrics',
  (language, period, title) => {
    const prompt = builders.assessment(language);
    expect(prompt).toContain(title);
    expect(prompt).toContain(`period to "${period}"`);
    expect(prompt).toContain(`"period": "${period}"`);
    expect(prompt).toContain('"runsAnalyzed": 0');
    expect(prompt).toContain('"avgHeartRate": null');
    expect(prompt).toContain('"trend": "maintaining"');
  },
);
