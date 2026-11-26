import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Decoder, Stream } from '@garmin/fitsdk';
import type { WatchPlan } from '../connect-iq/fit/workout-watch-plan';

export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export function seal(value: string, key: string): string {
  const bytes = Buffer.from(key, 'base64');
  if (bytes.length !== 32) throw new Error('ZEPP_TOKEN_KEY must be 32 bytes in base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', bytes, iv);
  return Buffer.concat([
    iv,
    cipher.update(value, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString('base64');
}
export function unseal(value: string, key: string): string {
  const b = Buffer.from(value, 'base64');
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), b.subarray(0, 12));
  cipher.setAuthTag(b.subarray(-16));
  return Buffer.concat([cipher.update(b.subarray(12, -16)), cipher.final()]).toString('utf8');
}
export function validateDownloadUrl(raw: string): string {
  const u = new URL(raw);
  if (
    u.protocol !== 'https:' ||
    u.hostname !== 'api-open.zepp.com' ||
    u.port ||
    u.username ||
    u.password ||
    u.pathname !== '/api/activity/file'
  ) {
    throw new Error('Invalid Zepp download destination');
  }
  return raw;
}
export function parseEvents(body: unknown): Record<string, any>[] {
  const outer = typeof body === 'string' ? JSON.parse(body) : body;
  if (!Array.isArray(outer) || outer.length > 100) throw new Error('Invalid webhook batch');
  return outer.map((item) => {
    const event = typeof item === 'string' ? JSON.parse(item) : item;
    if (!event || typeof event !== 'object' || Array.isArray(event))
      throw new Error('Invalid event');
    return event;
  });
}
// Unsupported targets are explicit until the partner contract has been verified on hardware.
export function zeppSteps(
  plan: WatchPlan,
  hrZones?: Record<string, { min: number; max: number }>,
): Record<string, any>[] {
  function range(from: number, to: number): Record<string, any>[] {
    const result: Record<string, any>[] = [];
    for (let i = to - 1; i >= from; i--) {
      const step = plan.steps[i];
      if ('repeatFrom' in step) {
        if (
          !Number.isInteger(step.repeatFrom) ||
          step.repeatFrom < from ||
          step.repeatFrom >= i ||
          !Number.isInteger(step.times) ||
          step.times < 1
        )
          throw new Error('Invalid repeat');
        result.unshift({
          type: 'WorkoutRepeatStep',
          repeatType: 'REPEAT_UNTIL_STEPS_CMPLT',
          repeatValue: step.times,
          steps: range(step.repeatFrom, i),
        });
        i = step.repeatFrom;
        continue;
      }
      if (step.duration.type === 'open' || !step.duration.value || !step.target)
        throw new Error('Treino incompatível: passo aberto ou sem alvo Zepp homologado.');
      const hr =
        step.target.type === 'hr'
          ? step.target.minBpm !== undefined || step.target.maxBpm !== undefined
            ? { min: step.target.minBpm, max: step.target.maxBpm }
            : hrZones?.[`zone${step.target.zone}`]
          : undefined;
      if (
        step.target.type === 'hr' &&
        (!hr ||
          typeof hr.min !== 'number' ||
          typeof hr.max !== 'number' ||
          !Number.isFinite(hr.min) ||
          !Number.isFinite(hr.max) ||
          hr.min <= 0 ||
          hr.max < hr.min)
      )
        throw new Error('Treino incompatível: zona de FC indisponível.');
      result.unshift({
        type: 'WorkoutStep',
        intensity: (step.intensity ?? 'active').toUpperCase(),
        durationType: step.duration.type.toUpperCase(),
        durationValue: step.duration.value,
        targetType: step.target.type === 'pace' ? 'PACE_LAP' : 'HEART_RATE_LAP',
        targetValueLow: step.target.type === 'pace' ? step.target.fastSecPerKm : hr!.min,
        targetValueHigh: step.target.type === 'pace' ? step.target.slowSecPerKm : hr!.max,
        description: step.name ?? step.notes ?? '',
      });
    }
    return result.map((step, index) => ({ ...step, stepOrder: index + 1 }));
  }
  if (plan.steps.length > 200) throw new Error('Treino incompatível: muitos passos');
  return range(0, plan.steps.length);
}
export function fitSummary(bytes: Uint8Array) {
  const decoder = new Decoder(Stream.fromByteArray(bytes));
  if (!decoder.isFIT() || !decoder.checkIntegrity()) throw new Error('FIT inválido');
  const { messages, errors } = new Decoder(Stream.fromByteArray(bytes)).read({
    convertTypesToStrings: true,
  });
  if (errors.length) throw new Error('FIT corrompido');
  const sessions = messages.sessionMesgs ?? [];
  if (sessions.length !== 1 || sessions[0].sport !== 'running')
    throw new Error('Atividade não é corrida simples');
  const s = sessions[0];
  return {
    hasRoute:
      (messages.recordMesgs ?? []).filter(
        (r: any) => Number.isFinite(r.positionLat) && Number.isFinite(r.positionLong),
      ).length >= 2,
    startedAt: s.startTime,
    endedAt: s.timestamp,
    distanceMeters: s.totalDistance ?? 0,
    timerSeconds: s.totalTimerTime ?? 0,
    avgHeartRate: s.avgHeartRate ?? null,
    maxHeartRate: s.maxHeartRate ?? null,
  };
}
