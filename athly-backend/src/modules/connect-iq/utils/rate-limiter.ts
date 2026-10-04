const PRUNE_THRESHOLD = 10_000;

/**
 * Limite em janela fixa, em memória e por instância. Basta para frear força bruta no código de
 * pareamento (10⁸ combinações, válido por 10 min); não é um limite global entre instâncias.
 */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Conta uma tentativa para `key`; `false` quando a janela atual já estourou o limite. */
  tryConsume(key: string): boolean {
    const now = this.now();
    if (this.windows.size >= PRUNE_THRESHOLD) this.prune(now);
    const window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (window.count >= this.limit) return false;
    window.count += 1;
    return true;
  }

  private prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
