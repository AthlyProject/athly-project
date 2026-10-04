import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { CodedUnauthorizedException } from '../../../common/errors/coded-exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { CiqEnvelopeFilter } from './ciq-envelope.filter';

describe('CiqEnvelopeFilter', () => {
  let response: { status: jest.Mock; setHeader: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    response = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = {
      method: 'GET',
      path: '/connect-iq/manifest',
      headers: { authorization: 'Bearer ciq_secret' },
    };
    host = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => jest.restoreAllMocks());

  it('devolve 200 com o status real e o code no corpo', () => {
    new CiqEnvelopeFilter().catch(
      new CodedUnauthorizedException(ErrorCode.CIQ_DEVICE_UNAUTHORIZED, 'Relógio desconectado.'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.setHeader).toHaveBeenCalledWith('X-Athly-Status', '401');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 401,
      error: 'Unauthorized',
      code: ErrorCode.CIQ_DEVICE_UNAUTHORIZED,
      message: 'Relógio desconectado.',
    });
  });

  it('mantém o corpo de validação e não loga o token', () => {
    new CiqEnvelopeFilter().catch(
      new BadRequestException({ statusCode: 400, code: 'VALIDATION_FAILED', message: ['x'] }),
      host,
    );

    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: ['x'],
    });
    const logged = String(warn.mock.calls[0][0]);
    expect(logged).toContain('"path":"/connect-iq/manifest"');
    expect(logged).not.toContain('ciq_secret');
  });

  it('esconde detalhes de erro inesperado e loga como erro', () => {
    new CiqEnvelopeFilter().catch(new Error('connection refused to 10.0.0.1'), host);

    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Erro interno. Tente de novo.',
    });
    expect(response.setHeader).toHaveBeenCalledWith('X-Athly-Status', '500');
    expect(error).toHaveBeenCalled();
  });
});
