import { createHash, randomBytes, randomInt } from 'node:crypto';

export const PAIRING_CODE_LENGTH = 8;
export const DEVICE_TOKEN_PREFIX = 'ciq_';

/** Hash guardado no banco no lugar de códigos e tokens. */
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** 8 dígitos (10⁸ combinações): teclado numérico no iPhone e fonte numérica no relógio. */
export const generatePairingCode = (): string =>
  String(randomInt(0, 10 ** PAIRING_CODE_LENGTH)).padStart(PAIRING_CODE_LENGTH, '0');

/** Só os dígitos do que o usuário digitou ("4821 3907", "4821-3907"). */
export const normalizePairingCode = (input: string): string => input.replace(/\D/g, '');

/** Segredo que só o relógio que pediu o código conhece; usado para buscar o token. */
export const generatePollToken = (): string => randomBytes(32).toString('base64url');

export const generateDeviceToken = (): string =>
  `${DEVICE_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;

/** Token do header `Authorization: Bearer …`, ou `null`. */
export const bearerToken = (header: string | undefined): string | null => {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? '');
  return match ? match[1] : null;
};
