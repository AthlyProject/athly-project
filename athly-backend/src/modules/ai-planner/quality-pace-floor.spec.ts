import { applyQualityPaceFloor } from './quality-pace-floor';
import type { WorkoutDay } from './types/planner.types';

function day(date: string, segments: any[], sportType: any = 'running'): WorkoutDay {
  return {
    date,
    dayOfWeek: 'Thursday',
    title: 'Threshold Run',
    description: '',
    sportType,
    intensity: 7,
    segments,
  } as WorkoutDay;
}

const warmup = { id: 'wu', kind: 'warmup', target: { hrZone: 2, rpe: 3 } };
const cooldown = { id: 'cd', kind: 'cooldown', target: { hrZone: 1, rpe: 2 } };

describe('applyQualityPaceFloor', () => {
  it('desloca para o limiar demonstrado um limiar prescrito mais lento (caso real 12/11)', () => {
    const main = {
      id: 'main-thu',
      kind: 'work',
      label: 'Threshold Run',
      target: { paceSecPerKmMin: 335, paceSecPerKmMax: 355, hrZone: 3, rpe: 7 },
    };
    const plan = [day('2026-11-12', [warmup, main, cooldown])];

    const adjustments = applyQualityPaceFloor(plan, 306);

    expect(main.target).toMatchObject({ paceSecPerKmMin: 306, paceSecPerKmMax: 326 });
    expect(adjustments).toHaveLength(1);
  });

  it('não mexe em faixas que já incluem o piso, em intervalos mais rápidos nem em easy', () => {
    const tempo = {
      id: 't',
      kind: 'work',
      target: { paceSecPerKmMin: 300, paceSecPerKmMax: 320, rpe: 7 },
    };
    const easy = {
      id: 'e',
      kind: 'work',
      target: { paceSecPerKmMin: 385, paceSecPerKmMax: 405, rpe: 4 },
    };
    const reps = {
      id: 'set',
      kind: 'set',
      repetitions: 5,
      children: [
        { id: 'rep', kind: 'work', target: { paceSecPerKmMin: 294, paceSecPerKmMax: 315, rpe: 8 } },
        { id: 'rec', kind: 'recovery', target: { rpe: 2 } },
      ],
    };
    const plan = [day('2026-11-10', [warmup, tempo, easy, reps, cooldown])];

    expect(applyQualityPaceFloor(plan, 306)).toEqual([]);
    expect(tempo.target.paceSecPerKmMin).toBe(300);
    expect(easy.target.paceSecPerKmMin).toBe(385);
    expect(reps.children[0].target).toMatchObject({ paceSecPerKmMin: 294, paceSecPerKmMax: 315 });
  });

  it('aplica o piso dentro de sets e ignora dias que não são corrida ou sem piso', () => {
    const rep = {
      id: 'rep',
      kind: 'work',
      target: { paceSecPerKmMin: 330, paceSecPerKmMax: 340, rpe: 8 },
    };
    const plan = [day('2026-11-10', [warmup, { id: 's', kind: 'set', children: [rep] }, cooldown])];
    const walk = {
      id: 'w',
      kind: 'work',
      target: { paceSecPerKmMin: 500, paceSecPerKmMax: 520, rpe: 7 },
    };
    const walking = day('2026-11-11', [walk], 'walking');

    expect(applyQualityPaceFloor([walking], 306)).toEqual([]);
    expect(applyQualityPaceFloor(plan, undefined)).toEqual([]);
    expect(applyQualityPaceFloor(plan, 306)).toHaveLength(1);
    expect(rep.target).toMatchObject({ paceSecPerKmMin: 306, paceSecPerKmMax: 316 });
  });
});
