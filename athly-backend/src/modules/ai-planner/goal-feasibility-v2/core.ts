import { createHash } from 'node:crypto';

export type LocalDate = string;
export type Instant = string;
export type Revision = number;
export const ENGINE_VERSION = 'goal-feasibility/1.1.0' as const;
export const POLICY_VERSION = 'duration-rpe/1.0.0' as const;
export const EPSILON = 1e-9;
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export class InputError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

export function requireInput(condition: unknown, code = 'INVALID_REQUEST'): asserts condition {
  if (!condition) throw new InputError(code);
}

export function finite(value: number): number {
  requireInput(Number.isFinite(value));
  return value;
}

export function integer(value: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  requireInput(Number.isSafeInteger(value) && value >= min && value <= max);
  return value;
}

export function oneOf<T extends string>(value: T, values: readonly T[]): T {
  requireInput(values.includes(value));
  return value;
}

export function instant(value: Instant): number {
  requireInput(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value));
  const result = Date.parse(value);
  requireInput(Number.isFinite(result));
  requireInput(new Date(result).toISOString().slice(0, 10) === value.slice(0, 10));
  return result;
}

export function civil(value: LocalDate): number {
  requireInput(/^\d{4}-\d\d-\d\d$/.test(value));
  const result = Date.parse(`${value}T00:00:00Z`);
  requireInput(Number.isFinite(result) && new Date(result).toISOString().slice(0, 10) === value);
  return result;
}

export function timeZone(value: string): void {
  requireInput(typeof value === 'string' && value.length > 0 && !/^[+-]/.test(value));
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
  } catch {
    throw new InputError('INVALID_REQUEST', 'Invalid IANA time zone');
  }
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
export function localDate(value: Instant, zone: string): LocalDate {
  let formatter = dateFormatters.get(zone);
  if (!formatter) {
    timeZone(zone);
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateFormatters.set(zone, formatter);
  }
  const parts = formatter.formatToParts(instant(value));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  integer(Math.abs(days));
  return new Date(civil(date) + days * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(from: LocalDate, through: LocalDate): number {
  return (civil(through) - civil(from)) / 86400000;
}

export function isoWeekday(date: LocalDate): number {
  return new Date(civil(date)).getUTCDay() || 7;
}

export function monday(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date));
}

/** First instant of a civil date, including zones whose midnight is skipped by DST. */
export function startOfDate(date: LocalDate, zone: string): Instant {
  const epoch = civil(date);
  timeZone(zone);
  let lo = epoch - 2 * 86400000;
  let hi = epoch + 2 * 86400000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDate(new Date(mid).toISOString(), zone) < date) lo = mid + 1;
    else hi = mid;
  }
  const result = new Date(lo).toISOString();
  requireInput(localDate(result, zone) === date);
  return result;
}

export function evaluationExpiresAt(asOf: Instant, zone: string): Instant {
  return new Date(
    Math.min(
      instant(asOf) + 86400000,
      instant(startOfDate(addDays(localDate(asOf, zone), 1), zone)),
    ),
  ).toISOString();
}

function canonical(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return finite(value);
  if (Array.isArray(value)) return value.map(canonical);
  requireInput(typeof value === 'object' && value !== null);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => compareText(a, b))
      .map(([k, v]) => [k, canonical(v)]),
  );
}

export function stableHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

export function floor30(value: number): number {
  return 30 * Math.floor(finite(value) / 30);
}

export function agrees(a: number, b: number): boolean {
  return 100 * Math.abs(a - b) <= 2 * Math.max(a, b) + EPSILON;
}

export function civilAge(on: LocalDate, asOf: Instant, zone: string): number {
  return daysBetween(on, localDate(asOf, zone));
}

export function owned(userId: string, objects: readonly { userId: string }[]): void {
  requireInput(
    userId.length > 0 && objects.every((o) => o.userId === userId),
    'ACCOUNT_SCOPE_MISMATCH',
  );
}
