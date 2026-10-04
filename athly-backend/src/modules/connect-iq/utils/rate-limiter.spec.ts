import { FixedWindowRateLimiter } from './rate-limiter';
import { bearerToken, normalizePairingCode } from './secrets';

describe('FixedWindowRateLimiter', () => {
  it('libera até o limite por chave e reabre quando a janela vira', () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(2, 1_000, () => now);

    expect(limiter.tryConsume('user-1')).toBe(true);
    expect(limiter.tryConsume('user-1')).toBe(true);
    expect(limiter.tryConsume('user-1')).toBe(false);
    expect(limiter.tryConsume('user-2')).toBe(true);

    now = 1_000;
    expect(limiter.tryConsume('user-1')).toBe(true);
  });
});

describe('secrets', () => {
  it('normaliza o código digitado com espaço ou hífen', () => {
    expect(normalizePairingCode('4821 3907')).toBe('48213907');
    expect(normalizePairingCode('4821-3907')).toBe('48213907');
  });

  it('extrai o token do header Authorization', () => {
    expect(bearerToken('Bearer ciq_abc')).toBe('ciq_abc');
    expect(bearerToken('bearer   ciq_abc ')).toBe('ciq_abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });
});
