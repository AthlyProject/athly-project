import { BadRequestException, NotFoundException, ValidationError } from '@nestjs/common';
import { CodedBadRequestException, CodedNotFoundException } from './coded-exception';
import { ErrorCode } from './error-codes';
import { validationExceptionFactory, ValidationErrorBody } from './validation-exception.factory';

const validationError = (
  property: string,
  constraints: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError => ({ property, constraints, children });

describe('CodedException', () => {
  it('coloca code e message no corpo, mantendo o formato do Nest', () => {
    const exception = new CodedBadRequestException(
      ErrorCode.AUTH_RESET_CODE_INVALID,
      'Código inválido ou expirado',
    );

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      code: ErrorCode.AUTH_RESET_CODE_INVALID,
      message: 'Código inválido ou expirado',
    });
  });

  it('continua sendo instância da exceção equivalente do Nest', () => {
    // Código existente faz `err instanceof NotFoundException` para decidir rethrow vs. 500.
    expect(
      new CodedNotFoundException(ErrorCode.WORKOUT_NOT_FOUND, 'Workout not found'),
    ).toBeInstanceOf(NotFoundException);
    expect(new CodedBadRequestException(ErrorCode.AUTH_LAST_CREDENTIAL, 'msg')).toBeInstanceOf(
      BadRequestException,
    );
  });

  it('expõe a message em Error.message, para os logs', () => {
    expect(
      new CodedNotFoundException(ErrorCode.WORKOUT_NOT_FOUND, 'Workout not found').message,
    ).toBe('Workout not found');
  });
});

describe('validationExceptionFactory', () => {
  const bodyOf = (errors: ValidationError[]) =>
    validationExceptionFactory(errors).getResponse() as ValidationErrorBody;

  it('deriva um código de campo + constraint e preserva message como string[]', () => {
    const body = bodyOf([
      validationError('password', {
        minLength: 'Senha deve ter no mínimo 8 caracteres',
      }),
    ]);

    expect(body.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(body.message).toEqual(['Senha deve ter no mínimo 8 caracteres']);
    expect(body.errors).toEqual([
      {
        field: 'password',
        constraint: 'minLength',
        code: 'VALIDATION_PASSWORD_MIN_LENGTH',
        message: 'Senha deve ter no mínimo 8 caracteres',
      },
    ]);
  });

  it('distingue a mesma constraint em campos diferentes', () => {
    const body = bodyOf([
      validationError('code', { matches: 'Código inválido' }),
      validationError('newPassword', { matches: 'Senha deve conter letras...' }),
    ]);

    expect(body.errors.map((error) => error.code)).toEqual([
      'VALIDATION_CODE_MATCHES',
      'VALIDATION_NEW_PASSWORD_MATCHES',
    ]);
  });

  it('achata erros aninhados e ignora índices de array no código', () => {
    const body = bodyOf([
      validationError('blocks', {}, [
        validationError('0', {}, [validationError('duration', { isNumber: 'duration inválida' })]),
        validationError('3', {}, [validationError('duration', { isNumber: 'duration inválida' })]),
      ]),
    ]);

    // O caminho com índice fica em `field` (útil pra apontar o campo); o código, não — o
    // cliente traduz por significado, e "o bloco 3 é inválido" não merece string própria.
    expect(body.errors.map((error) => error.field)).toEqual([
      'blocks.0.duration',
      'blocks.3.duration',
    ]);
    expect(new Set(body.errors.map((error) => error.code))).toEqual(
      new Set(['VALIDATION_BLOCKS_DURATION_IS_NUMBER']),
    );
  });

  it('reporta todas as constraints falhas de um mesmo campo', () => {
    const body = bodyOf([
      validationError('email', {
        isEmail: 'Email inválido',
        isNotEmpty: 'Email é obrigatório',
      }),
    ]);

    expect(body.errors.map((error) => error.code)).toEqual([
      'VALIDATION_EMAIL_IS_EMAIL',
      'VALIDATION_EMAIL_IS_NOT_EMPTY',
    ]);
  });
});
