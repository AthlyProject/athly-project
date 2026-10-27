import { Logger, type ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';
import { UserLanguageInterceptor } from './user-language.interceptor';

describe('UserLanguageInterceptor', () => {
  const update = jest.fn();
  const interceptor = new UserLanguageInterceptor({ user: { update } } as unknown as PrismaService);
  const next = { handle: jest.fn(() => of('response')) };
  let request: {
    headers: Record<string, string | string[]>;
    user?: { id: string; language: string | null };
  };
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    update.mockReset().mockResolvedValue({});
    next.handle.mockClear();
    request = { headers: {}, user: { id: 'user-1', language: 'de' } };
  });

  it('prioritizes the app header over Accept-Language', async () => {
    request.headers = { 'x-athly-language': 'en-US', 'accept-language': 'pt-BR' };
    await interceptor.intercept(context, next);
    expect(update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { language: 'en' } });
    expect(request.user?.language).toBe('en');
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('uses Accept-Language when the app header is absent', async () => {
    request.headers = { 'accept-language': 'fr, pt-PT;q=0.8, en;q=1' };
    await interceptor.intercept(context, next);
    expect(update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { language: 'pt-BR' } });
  });

  it('handles array-valued headers in the same order', async () => {
    request.headers = { 'x-athly-language': ['fr', 'en-US'] };
    await interceptor.intercept(context, next);
    expect(request.user?.language).toBe('en');
  });

  it('preserves the stored preference when both headers are absent', async () => {
    await interceptor.intercept(context, next);
    expect(update).not.toHaveBeenCalled();
    expect(request.user?.language).toBe('de');
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('does not persist preferences for unauthenticated requests', async () => {
    delete request.user;
    request.headers = { 'x-athly-language': 'en' };
    await interceptor.intercept(context, next);
    expect(update).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('does not write when the normalized language is unchanged', async () => {
    request.headers = { 'x-athly-language': 'de-DE' };
    await interceptor.intercept(context, next);
    await interceptor.intercept(context, next);
    expect(update).not.toHaveBeenCalled();
  });

  it('persists the default once for an explicit empty header and a null preference', async () => {
    request.user!.language = null;
    request.headers = { 'x-athly-language': '' };
    await interceptor.intercept(context, next);
    await interceptor.intercept(context, next);
    expect(update).toHaveBeenCalledTimes(1);
    expect(request.user?.language).toBe('pt-BR');
  });

  it('finishes persistence before invoking the controller', async () => {
    let finishUpdate!: () => void;
    update.mockReturnValue(
      new Promise<void>((resolve) => {
        finishUpdate = resolve;
      }),
    );
    request.headers = { 'x-athly-language': 'en' };
    const pending = interceptor.intercept(context, next);
    expect(next.handle).not.toHaveBeenCalled();
    finishUpdate();
    await pending;
    expect(next.handle).toHaveBeenCalledTimes(1);
    expect(request.user?.language).toBe('en');
  });

  it('logs a failed update and still invokes the controller', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      update.mockRejectedValue(new Error('database unavailable'));
      request.headers = { 'x-athly-language': 'en' };
      await interceptor.intercept(context, next);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('database unavailable'));
      expect(next.handle).toHaveBeenCalledTimes(1);
      expect(request.user?.language).toBe('de');
    } finally {
      warn.mockRestore();
    }
  });

  it('ignores non-HTTP execution contexts', async () => {
    const nonHttp = { getType: () => 'rpc' } as unknown as ExecutionContext;
    await interceptor.intercept(nonHttp, next);
    expect(update).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalledTimes(1);
  });
});
