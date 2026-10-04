import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Erros das rotas JSON do relógio saem como HTTP 200 com `{statusCode, code, message}` no corpo.
 * Nos relógios, o Garmin Connect repete ou achata respostas não-200 (vira 0 ou -300) e o app
 * perde o motivo do erro; com o envelope ele sempre lê o status real.
 */
@Catch()
export class CiqEnvelopeFilter implements ExceptionFilter {
  private readonly logger = new Logger('ConnectIq');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body =
      payload && typeof payload === 'object'
        ? { ...(payload as Record<string, unknown>), statusCode: status }
        : {
            statusCode: status,
            message: typeof payload === 'string' ? payload : 'Erro interno. Tente de novo.',
          };

    // Só método, caminho (sem query) e status — nunca headers, onde está o token.
    const line = JSON.stringify({
      event: 'ciq_request_failed',
      method: request.method,
      path: request.path,
      status,
      code: (body as { code?: unknown }).code ?? null,
    });
    if (status >= 500) this.logger.error(line, (exception as Error)?.stack);
    else this.logger.warn(line);

    response
      .status(200)
      .setHeader('X-Athly-Status', String(status))
      .setHeader('Cache-Control', 'no-store')
      .json(body);
  }
}
