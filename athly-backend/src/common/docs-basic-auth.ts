import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/** Rotas servidas por `SwaggerModule.setup('docs', …)`. '/docs' também cobre os assets da UI. */
export const SWAGGER_DOCS_PATHS = ['/docs', '/docs-json', '/docs-yaml'];

/** Hash antes de comparar deixa os dois buffers do mesmo tamanho — `timingSafeEqual` exige isso. */
const matches = (a: string, b: string): boolean =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

/**
 * Basic Auth para a documentação da API. Escrito aqui em vez de usar `express-basic-auth`:
 * aquele pacote está sem manutenção e a comparação dele não é de tempo constante por padrão.
 */
export function docsBasicAuth(user: string, password: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const [scheme, encoded] = (req.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() === 'basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const sep = decoded.indexOf(':'); // primeiro ':' — a senha pode conter outros
      if (sep > 0) {
        // Os dois são comparados antes do `&&`: assim o tempo de resposta não revela
        // que o usuário estava correto e só a senha errou.
        const userOk = matches(decoded.slice(0, sep), user);
        const passOk = matches(decoded.slice(sep + 1), password);
        if (userOk && passOk) return next();
      }
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Athly API docs", charset="UTF-8"');
    res.status(401).send('Unauthorized');
  };
}
