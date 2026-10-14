import { minPaceWindowSec, widenPaceRange, widenSegmentPaceTargets } from './pace-range';

describe('widenPaceRange', () => {
  it('alarga uma faixa de 10 s para 20 s em volta do meio', () => {
    expect(widenPaceRange({ minSecPerKm: 310, maxSecPerKm: 320 })).toEqual({
      minSecPerKm: 305,
      maxSecPerKm: 325,
    });
  });

  it('mantém faixas que já têm a largura mínima', () => {
    expect(widenPaceRange({ minSecPerKm: 390, maxSecPerKm: 420 })).toEqual({
      minSecPerKm: 390,
      maxSecPerKm: 420,
    });
  });

  it('usa 6% do pace em paces lentos', () => {
    expect(minPaceWindowSec(300)).toBe(20);
    expect(minPaceWindowSec(450)).toBe(27);
    expect(widenPaceRange({ minSecPerKm: 440, maxSecPerKm: 460 })).toEqual({
      minSecPerKm: 436,
      maxSecPerKm: 464,
    });
  });

  it('corrige limites invertidos', () => {
    expect(widenPaceRange({ minSecPerKm: 330, maxSecPerKm: 300 })).toEqual({
      minSecPerKm: 300,
      maxSecPerKm: 330,
    });
  });
});

describe('widenSegmentPaceTargets', () => {
  it('alarga alvos de pace dentro de sets e preserva o resto do alvo', () => {
    const segments = [
      { id: 'wu', kind: 'warmup', target: { rpe: 3 } },
      {
        id: 'set',
        kind: 'set',
        children: [
          { id: 'w', kind: 'work', target: { paceSecPerKmMin: 310, paceSecPerKmMax: 320, rpe: 8 } },
        ],
      },
      { id: 'single', kind: 'work', target: { paceSecPerKmMin: 300 } },
    ];
    widenSegmentPaceTargets(segments);
    expect(segments[0].target).toEqual({ rpe: 3 });
    expect(segments[1].children?.[0].target).toEqual({
      paceSecPerKmMin: 305,
      paceSecPerKmMax: 325,
      rpe: 8,
    });
    expect(segments[2].target).toEqual({ paceSecPerKmMin: 300 });
  });

  it('ignora entradas que não são árvore', () => {
    expect(() => widenSegmentPaceTargets(null)).not.toThrow();
    expect(() => widenSegmentPaceTargets([null, 'x'])).not.toThrow();
  });
});
