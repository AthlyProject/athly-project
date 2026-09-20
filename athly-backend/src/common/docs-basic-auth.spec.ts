import type { NextFunction, Request, Response } from 'express';
import { SWAGGER_DOCS_PATHS, docsBasicAuth } from './docs-basic-auth';

const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;

const run = (authorization?: string, user = 'athly', password = 's3cr3t') => {
  const req = { headers: authorization ? { authorization } : {} } as Request;
  const res = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as Response & { setHeader: jest.Mock; status: jest.Mock; send: jest.Mock };
  const next = jest.fn() as unknown as NextFunction;

  docsBasicAuth(user, password)(req, res, next);
  return { res, next };
};

describe('docsBasicAuth', () => {
  it('libera quando usuário e senha conferem', () => {
    const { res, next } = run(basic('athly', 's3cr3t'));

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responde 401 com WWW-Authenticate quando não há header', () => {
    const { res, next } = run();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Basic realm="Athly API docs", charset="UTF-8"',
    );
  });

  it('responde 401 quando a senha está errada', () => {
    const { res, next } = run(basic('athly', 'errada'));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('responde 401 quando o usuário está errado', () => {
    const { res, next } = run(basic('outro', 's3cr3t'));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('aceita senha contendo ":" — o split usa só o primeiro separador', () => {
    const { next } = run(basic('athly', 'a:b:c'), 'athly', 'a:b:c');

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('responde 401 para esquema diferente de Basic', () => {
    const { res, next } = run('Bearer um-token-qualquer');

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('cobre a UI, o JSON e o YAML servidos pelo Swagger', () => {
    expect(SWAGGER_DOCS_PATHS).toEqual(['/docs', '/docs-json', '/docs-yaml']);
  });
});
