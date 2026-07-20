import {
  assessFeasibility,
  assessGoalFeasibility,
  parseTargetDistanceMeters,
  parseTargetTimeSeconds,
  weeksBetween,
} from './goal-feasibility';
import { calculateVdot } from '../effort-zones/vdot-calculator';

// VDOT necessário para 5km em 25:00 — derivado, não memorizado, para os testes
// permanecerem robustos a recalibrações da fórmula.
const REQUIRED_5K_SUB25 = calculateVdot(5000, 1500);
const base = {
  targetDistanceMeters: 5000,
  targetTimeSec: 1500,
  startDateISO: '2026-06-24',
  experienceLevel: 'intermediate' as const,
};

describe('parsers', () => {
  it('parseTargetDistanceMeters', () => {
    expect(parseTargetDistanceMeters('5k')).toBe(5000);
    expect(parseTargetDistanceMeters('10K')).toBe(10000);
    expect(parseTargetDistanceMeters('21k')).toBe(21097.5);
    expect(parseTargetDistanceMeters('42k')).toBe(42195);
    expect(parseTargetDistanceMeters('8km')).toBe(8000);
    expect(parseTargetDistanceMeters('half')).toBe(21097.5);
    expect(parseTargetDistanceMeters('outro')).toBeNull();
    expect(parseTargetDistanceMeters(null)).toBeNull();
  });

  it('parseTargetTimeSeconds', () => {
    expect(parseTargetTimeSeconds('00:25:00')).toBe(1500);
    expect(parseTargetTimeSeconds('25:00')).toBe(1500);
    expect(parseTargetTimeSeconds('25min')).toBe(1500);
    expect(parseTargetTimeSeconds('1:45:00')).toBe(6300);
    expect(parseTargetTimeSeconds('1h30')).toBe(5400);
    expect(parseTargetTimeSeconds(null)).toBeNull();
  });

  it('weeksBetween floors whole weeks', () => {
    expect(weeksBetween('2026-06-24', '2026-08-20')).toBe(8); // 57 dias
    expect(weeksBetween('2026-06-24', '2026-06-24')).toBe(0);
    expect(weeksBetween('2026-06-24', '2026-06-10')).toBe(-2); // passado
  });
});

describe('assessFeasibility — bandas de veredito', () => {
  it('ready quando o atleta já tem o VDOT exigido', () => {
    const f = assessFeasibility({
      ...base,
      currentVdot: REQUIRED_5K_SUB25 + 2,
      weeksAvailable: 10,
    });
    expect(f.verdict).toBe('ready');
    expect(f.suggestion.realisticTimeSec).toBeNull();
    expect(f.suggestion.suggestedDate).toBeNull();
  });

  it('feasible quando o gap fecha dentro da janela', () => {
    const f = assessFeasibility({
      ...base,
      currentVdot: REQUIRED_5K_SUB25 - 3,
      weeksAvailable: 40,
    });
    expect(f.verdict).toBe('feasible');
  });

  it('ambitious dentro da margem de 1 VDOT além do projetado', () => {
    const f = assessFeasibility({ ...base, currentVdot: REQUIRED_5K_SUB25 - 1, weeksAvailable: 0 });
    expect(f.verdict).toBe('ambitious');
  });

  it('unrealistic quando o gap é grande para a janela, com alternativa sugerida', () => {
    const f = assessFeasibility({
      ...base,
      currentVdot: REQUIRED_5K_SUB25 - 10,
      weeksAvailable: 2,
    });
    expect(f.verdict).toBe('unrealistic');
    // Tempo realista até a data é MAIS LENTO que a meta (25:00 = 1500s).
    expect(f.suggestion.realisticTimeSec).not.toBeNull();
    expect(f.suggestion.realisticTimeSec!).toBeGreaterThan(1500);
    // Data sugerida é posterior ao início.
    expect(f.suggestion.suggestedDate).not.toBeNull();
    expect(f.suggestion.suggestedDate! > base.startDateISO).toBe(true);
  });
});

describe('assessGoalFeasibility — wrapper sobre o ParsedGoal', () => {
  it('null sem data de evento', () => {
    expect(
      assessGoalFeasibility({
        goal: { targetDistance: '5k', targetTime: '25:00', eventDate: null },
        currentVdot: 40,
        asOfISO: '2026-06-24',
      }),
    ).toBeNull();
  });

  it('null quando distância/tempo não são parseáveis', () => {
    expect(
      assessGoalFeasibility({
        goal: { targetDistance: 'outro', targetTime: '25:00', eventDate: '2026-08-20' },
        currentVdot: 40,
        asOfISO: '2026-06-24',
      }),
    ).toBeNull();
  });

  it('null quando o evento já passou', () => {
    expect(
      assessGoalFeasibility({
        goal: { targetDistance: '5k', targetTime: '25:00', eventDate: '2026-06-01' },
        currentVdot: 40,
        asOfISO: '2026-06-24',
      }),
    ).toBeNull();
  });

  it('computa feasibility para meta datada', () => {
    const f = assessGoalFeasibility({
      goal: {
        targetDistance: '5k',
        targetTime: '25:00',
        eventDate: '2026-12-31',
        experienceLevel: 'intermediate',
      },
      currentVdot: REQUIRED_5K_SUB25 - 3,
      asOfISO: '2026-06-24',
    });
    expect(f).not.toBeNull();
    expect(f!.weeksAvailable).toBeGreaterThan(20);
    expect(f!.targetDistanceMeters).toBe(5000);
    expect(f!.targetTimeSec).toBe(1500);
  });
});
