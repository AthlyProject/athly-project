import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import {
  ConnectIqActivityHeaderDto,
  ConnectIqActivityPartDto,
  ResolveConnectIqActivityDto,
  WatchActivityStatusQueryDto,
} from './connect-iq-activity.dto';

// Mesmas opções do pipe global (src/main.ts): campo desconhecido é erro.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validate = (metatype: ArgumentMetadata['metatype'], value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });

/** O que o campo de dados manda (ver athly-garmin/field/source/Uploader.mc). */
const watchHeader = () => ({
  id: '1792152000',
  start: 1792152000,
  end: 1792154700,
  utcOffset: -10800,
  distance: 8012.39990234375,
  timer: 2650.5,
  hrAvg: 151,
  hrMax: 178,
  parts: 2,
  laps: [
    {
      index: 0,
      start: 0,
      end: 600,
      distance: 1700.2,
      timer: 600,
      hrAvg: 132,
      hrMax: 140,
      intensity: 2,
    },
    { index: 1, start: 600, end: 2700, distance: 6312.1, timer: 2050.5 },
  ],
  pauses: [1200, 1250],
  appVersion: '1.0.0',
});

describe('ConnectIqActivityHeaderDto', () => {
  it('aceita o cabeçalho que o relógio monta', async () => {
    await expect(validate(ConnectIqActivityHeaderDto, watchHeader())).resolves.toBeInstanceOf(
      ConnectIqActivityHeaderDto,
    );
  });

  it('recusa campo desconhecido (o relógio precisa acompanhar o contrato)', async () => {
    await expect(
      validate(ConnectIqActivityHeaderDto, { ...watchHeader(), extra: 1 }),
    ).rejects.toThrow();
  });

  it.each([
    ['id com caracteres inválidos', { id: '../etc' }],
    ['fuso acima de 14 h', { utcOffset: 15 * 3600 }],
    ['pausa negativa', { pauses: [-1, 10] }],
    ['blocos demais', { parts: 201 }],
    [
      'FC impossível na volta',
      { laps: [{ index: 0, start: 0, end: 1, distance: 1, timer: 1, hrAvg: 400 }] },
    ],
  ])('recusa %s', async (_label, overrides) => {
    await expect(
      validate(ConnectIqActivityHeaderDto, { ...watchHeader(), ...overrides }),
    ).rejects.toThrow();
  });
});

describe('ConnectIqActivityPartDto', () => {
  it('aceita base64 padrão', async () => {
    const data = Buffer.alloc(13 * 500).toString('base64');
    await expect(validate(ConnectIqActivityPartDto, { seq: 0, data })).resolves.toBeDefined();
  });

  it('recusa texto que não é base64', async () => {
    await expect(
      validate(ConnectIqActivityPartDto, { seq: 0, data: 'não é base64!' }),
    ).rejects.toThrow();
  });
});

describe('ResolveConnectIqActivityDto', () => {
  it('exige o treino ao vincular', async () => {
    await expect(validate(ResolveConnectIqActivityDto, { resolution: 'linked' })).rejects.toThrow();
    await expect(
      validate(ResolveConnectIqActivityDto, {
        resolution: 'linked',
        workoutId: '0c6b2a1e-7f4e-4b8e-9a51-3f1a2b3c4d5e',
      }),
    ).resolves.toBeDefined();
  });

  it('dispensa o treino para corrida livre ou ignorada', async () => {
    await expect(
      validate(ResolveConnectIqActivityDto, { resolution: 'free_run' }),
    ).resolves.toBeDefined();
    await expect(
      validate(ResolveConnectIqActivityDto, { resolution: 'dismissed' }),
    ).resolves.toBeDefined();
  });
});

describe('WatchActivityStatusQueryDto', () => {
  it('aceita até 10 ids separados por vírgula', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => String(1792152000 + i)).join(',');
    await expect(validate(WatchActivityStatusQueryDto, { ids })).resolves.toBeDefined();
  });

  it('recusa mais de 10 ids, vazio ou caracteres fora do id', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => String(i)).join(',');
    await expect(validate(WatchActivityStatusQueryDto, { ids })).rejects.toThrow();
    await expect(validate(WatchActivityStatusQueryDto, { ids: '' })).rejects.toThrow();
    await expect(validate(WatchActivityStatusQueryDto, { ids: 'a;b' })).rejects.toThrow();
  });
});
