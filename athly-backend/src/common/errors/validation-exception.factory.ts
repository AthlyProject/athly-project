import { BadRequestException, HttpStatus, ValidationError } from '@nestjs/common';
import { ErrorCode } from './error-codes';

/** Uma falha de constraint já achatada, com o caminho completo do campo. */
export interface FieldError {
  /** Caminho do campo no payload, com índices: `email`, `blocks.0.duration`. */
  field: string;
  /** Nome da constraint do class-validator: `minLength`, `isEmail`, `matches`… */
  constraint: string;
  /** Código estável derivado de campo + constraint: `VALIDATION_PASSWORD_MIN_LENGTH`. */
  code: string;
  /** Texto em pt-BR do DTO (ou o padrão do class-validator), mantido como fallback. */
  message: string;
}

/** Resposta de 400 por validação. `message` continua sendo o `string[]` que o Nest produzia. */
export interface ValidationErrorBody {
  statusCode: number;
  error: string;
  code: typeof ErrorCode.VALIDATION_FAILED;
  message: string[];
  errors: FieldError[];
}

const toScreamingSnake = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toUpperCase();

/**
 * Deriva o código a partir do caminho do campo e da constraint, sem índices de array — o
 * cliente mapeia por significado, não por posição. `blocks.0.duration` + `isNumber` vira
 * `VALIDATION_BLOCKS_DURATION_IS_NUMBER`, igual para qualquer índice.
 */
function validationCode(field: string, constraint: string): string {
  const path = field
    .split('.')
    .filter((segment) => !/^\d+$/.test(segment))
    .map(toScreamingSnake)
    .join('_');
  return ['VALIDATION', path, toScreamingSnake(constraint)].filter(Boolean).join('_');
}

/** Percorre a árvore de erros (objetos e arrays aninhados) montando o caminho de cada campo. */
function flatten(errors: ValidationError[], parentPath = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;

    const own = Object.entries(error.constraints ?? {}).map(([constraint, message]) => ({
      field,
      constraint,
      code: validationCode(field, constraint),
      message,
    }));

    return [...own, ...flatten(error.children ?? [], field)];
  });
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const fieldErrors = flatten(errors);
  const body: ValidationErrorBody = {
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: ErrorCode.VALIDATION_FAILED,
    message: fieldErrors.map((error) => error.message),
    errors: fieldErrors,
  };
  return new BadRequestException(body);
}
