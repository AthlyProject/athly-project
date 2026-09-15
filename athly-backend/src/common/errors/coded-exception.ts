import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCode } from './error-codes';

/**
 * Corpo de erro da API, no mesmo formato do Nest (`statusCode`/`error`/`message`) mais o
 * campo `code`. Manter o formato original é o que deixa a mudança compatível com os clientes
 * que hoje leem só `message`.
 */
export interface CodedErrorBody {
  statusCode: number;
  error: string;
  code: ErrorCode;
  message: string;
}

function body(
  statusCode: HttpStatus,
  error: string,
  code: ErrorCode,
  message: string,
): CodedErrorBody {
  return { statusCode, error, code, message };
}

/**
 * Cada classe estende a exceção equivalente do Nest — `instanceof NotFoundException` e afins
 * continuam valendo para quem já trata esses tipos (ex.: `workouts.service.ts` rethrowa
 * `NotFoundException` antes de virar 500).
 */
export class CodedBadRequestException extends BadRequestException {
  constructor(code: ErrorCode, message: string) {
    super(body(HttpStatus.BAD_REQUEST, 'Bad Request', code, message));
  }
}

export class CodedUnauthorizedException extends UnauthorizedException {
  constructor(code: ErrorCode, message: string) {
    super(body(HttpStatus.UNAUTHORIZED, 'Unauthorized', code, message));
  }
}

export class CodedForbiddenException extends ForbiddenException {
  constructor(code: ErrorCode, message: string) {
    super(body(HttpStatus.FORBIDDEN, 'Forbidden', code, message));
  }
}

export class CodedNotFoundException extends NotFoundException {
  constructor(code: ErrorCode, message: string) {
    super(body(HttpStatus.NOT_FOUND, 'Not Found', code, message));
  }
}

export class CodedConflictException extends ConflictException {
  constructor(code: ErrorCode, message: string) {
    super(body(HttpStatus.CONFLICT, 'Conflict', code, message));
  }
}

export class CodedInternalServerErrorException extends InternalServerErrorException {
  constructor(code: ErrorCode, message: string) {
    super(body(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', code, message));
  }
}

export class CodedBadGatewayException extends BadGatewayException {
  constructor(code: ErrorCode, message: string) {
    super(body(HttpStatus.BAD_GATEWAY, 'Bad Gateway', code, message));
  }
}
