import { Decoder, Stream } from '@garmin/fitsdk';
import { encodeWorkoutFit, fitSerialNumber } from './fit-file';
import { FitWorkoutPlan } from './workout-fit-plan';

const plan: FitWorkoutPlan = {
  name: '07/10 Intervalado 6x400m',
  rev: 'abc123abc123',
  steps: [
    {
      wktStepName: 'Aquecimento',
      notes: 'RPE 3',
      intensity: 'warmup',
      durationType: 'time',
      durationValue: 600_000,
      targetType: 'open',
    },
    {
      wktStepName: '400m forte',
      intensity: 'active',
      durationType: 'distance',
      durationValue: 40_000,
      targetType: 'speed',
      targetValue: 0,
      customTargetValueLow: 3390,
      customTargetValueHigh: 3571,
    },
    {
      wktStepName: 'Recuperação',
      intensity: 'recovery',
      durationType: 'time',
      durationValue: 90_000,
      targetType: 'heartRate',
      targetValue: 2,
    },
    { durationType: 'repeatUntilStepsCmplt', durationValue: 1, targetValue: 6 },
    { wktStepName: 'Solto', intensity: 'cooldown', durationType: 'open', targetType: 'open' },
  ],
};

const decode = (bytes: Uint8Array) => {
  const decoder = new Decoder(Stream.fromByteArray(bytes));
  expect(decoder.isFIT()).toBe(true);
  expect(decoder.checkIntegrity()).toBe(true);
  const { messages, errors } = new Decoder(Stream.fromByteArray(bytes)).read({
    expandSubFields: true,
    applyScaleAndOffset: true,
    convertTypesToStrings: true,
  });
  expect(errors).toEqual([]);
  return messages;
};

describe('encodeWorkoutFit', () => {
  const timeCreated = new Date('2026-10-04T12:00:00.000Z');
  const bytes = encodeWorkoutFit(plan, { serialNumber: 0x3f2a9c1e, timeCreated });

  it('gera um arquivo FIT íntegro com cabeçalho de protocolo 1.0', () => {
    expect(bytes[0]).toBe(14);
    expect(bytes[1]).toBe(0x10);
    expect(Buffer.from(bytes.subarray(8, 12)).toString('ascii')).toBe('.FIT');
    decode(bytes);
  });

  it('identifica o arquivo como treino de corrida', () => {
    const messages = decode(bytes);

    expect(messages.fileIdMesgs?.[0]).toMatchObject({
      type: 'workout',
      manufacturer: 'development',
      product: 1,
      serialNumber: 0x3f2a9c1e,
    });
    expect(messages.workoutMesgs?.[0]).toMatchObject({
      wktName: '07/10 Intervalado 6x400m',
      sport: 'running',
      subSport: 'generic',
      numValidSteps: 5,
    });
  });

  it('grava durações, alvos e a repetição nos subcampos que o relógio lê', () => {
    const [warmup, work, recovery, repeat, cooldown] = decode(bytes).workoutStepMesgs ?? [];

    expect(warmup).toMatchObject({
      messageIndex: 0,
      wktStepName: 'Aquecimento',
      notes: 'RPE 3',
      intensity: 'warmup',
      durationType: 'time',
      durationTime: 600,
      targetType: 'open',
    });
    expect(work).toMatchObject({
      intensity: 'active',
      durationType: 'distance',
      durationDistance: 400,
      targetType: 'speed',
      targetSpeedZone: 0,
      customTargetSpeedLow: 3.39,
      customTargetSpeedHigh: 3.571,
    });
    expect(recovery).toMatchObject({
      wktStepName: 'Recuperação',
      intensity: 'recovery',
      durationTime: 90,
      targetType: 'heartRate',
      targetHrZone: 2,
    });
    expect(repeat).toMatchObject({
      messageIndex: 3,
      durationType: 'repeatUntilStepsCmplt',
      durationStep: 1,
      repeatSteps: 6,
    });
    expect(cooldown).toMatchObject({ intensity: 'cooldown', durationType: 'open' });
  });
});

describe('fitSerialNumber', () => {
  it('usa os 8 primeiros dígitos hex do UUID e nunca devolve 0', () => {
    expect(fitSerialNumber('3f2a9c1e-0000-4000-8000-000000000001')).toBe(0x3f2a9c1e);
    expect(fitSerialNumber('00000000-0000-4000-8000-000000000001')).toBe(1);
  });
});
