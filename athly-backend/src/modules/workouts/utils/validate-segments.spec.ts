import { validateSegmentTree, isStructurallyCompleteRun } from './validate-segments';

const wu = { id: 'wu', kind: 'warmup', end: { by: 'durationSec', value: 600 } };
const cd = { id: 'cd', kind: 'cooldown', end: { by: 'durationSec', value: 300 } };
const work = { id: 'main', kind: 'work', end: { by: 'distanceM', value: 5000 } };
const set = {
  id: 'set',
  kind: 'set',
  repetitions: 4,
  children: [
    { id: 'w', kind: 'work', end: { by: 'distanceM', value: 800 } },
    { id: 'r', kind: 'recovery', end: { by: 'durationSec', value: 120 } },
  ],
};

describe('isStructurallyCompleteRun', () => {
  it('aceita corrida com warmup + work + cooldown', () => {
    expect(isStructurallyCompleteRun([wu, work, cd]).ok).toBe(true);
  });

  it('aceita treino de tiros (warmup + set + cooldown)', () => {
    expect(isStructurallyCompleteRun([wu, set, cd]).ok).toBe(true);
  });

  it('reprova corrida com bloco único (só work) — caso do "main" degenerado', () => {
    const r = isStructurallyCompleteRun([work]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/warmup/);
  });

  it('reprova quando falta cooldown', () => {
    const r = isStructurallyCompleteRun([wu, work]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/cooldown/);
  });

  it('reprova quando falta o bloco principal (só warmup + cooldown)', () => {
    const r = isStructurallyCompleteRun([wu, cd]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/main/);
  });

  it('reprova árvore inválida (vazia)', () => {
    expect(isStructurallyCompleteRun([]).ok).toBe(false);
    expect(validateSegmentTree([]).ok).toBe(false);
  });
});
