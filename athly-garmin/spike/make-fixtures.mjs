// Gera os arquivos FIT do spike (Phase 0) com o encoder de produção do backend.
// Pré-requisito: `npm install && npm run build` em athly-backend.
// Uso: node athly-garmin/spike/make-fixtures.mjs   → athly-garmin/spike/fixtures/*.fit
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = new URL('.', import.meta.url);
const backend = new URL('../../athly-backend/', import.meta.url);
const require = createRequire(new URL('package.json', backend));
const fitDir = new URL('dist/src/modules/connect-iq/fit/', backend);
const { encodeWorkoutFit } = require(fileURLToPath(new URL('fit-file.js', fitDir)));
const { buildFitPlan } = require(fileURLToPath(new URL('workout-fit-plan.js', fitDir)));
const { CrcCalculator, Decoder, Stream } = await import(
  pathToFileURL(require.resolve('@garmin/fitsdk')).href
);

const out = new URL('fixtures/', here);
mkdirSync(out, { recursive: true });

const plan = (title, segments) => {
  const result = buildFitPlan({
    id: '3f2a9c1e-0000-4000-8000-000000000001',
    title,
    dateScheduled: new Date('2026-10-07T00:00:00Z'),
    sportType: 'running',
    segments,
  });
  if (!result.ok) throw new Error(`${title}: ${result.reason}`);
  return result.plan;
};

const warmup = { id: 'wu', kind: 'warmup', label: 'Aquecimento', end: { by: 'durationSec', value: 600 }, target: { rpe: 3 } };
const cooldown = { id: 'cd', kind: 'cooldown', label: 'Volta à calma', end: { by: 'durationSec', value: 300 } };
const repeats = {
  id: 'set',
  kind: 'set',
  repetitions: 6,
  children: [
    { id: 'w', kind: 'work', label: '400m forte', end: { by: 'distanceM', value: 400 }, target: { paceSecPerKmMin: 280, paceSecPerKmMax: 295 } },
    { id: 'r', kind: 'recovery', label: 'Recuperação', end: { by: 'durationSec', value: 90 }, target: { rpe: 3 } },
  ],
};

const easy = plan('Spike rodagem', [
  { ...warmup, end: { by: 'durationSec', value: 300 } },
  { id: 'main', kind: 'work', label: 'Rodagem', end: { by: 'distanceM', value: 3000 }, target: { paceSecPerKmMin: 345 } },
  cooldown,
]);
const intervals = plan('Spike tiros recovery', [warmup, repeats, cooldown]);

/** Mesmo arquivo com outro byte de versão do protocolo (e CRCs refeitos). */
const withProtocol = (bytes, version) => {
  const copy = Uint8Array.from(bytes);
  copy[1] = version;
  const view = new DataView(copy.buffer);
  view.setUint16(12, CrcCalculator.calculateCRC(copy, 0, 12), true);
  view.setUint16(copy.length - 2, CrcCalculator.calculateCRC(copy, 0, copy.length - 2), true);
  return copy;
};

const encode = (p) => encodeWorkoutFit(p, { serialNumber: 0x5b1e0000 + Math.floor(Math.random() * 0xffff), timeCreated: new Date() });

const fixtures = {
  'easy-run': encode(easy),
  'intervals-recovery': encode(intervals),
  'intervals-rest': encode({
    ...intervals,
    name: 'Spike tiros rest',
    steps: intervals.steps.map((s) => (s.intensity === 'recovery' ? { ...s, intensity: 'rest' } : s)),
  }),
  'hr-zone': encode(
    plan('Spike zona FC', [warmup, { id: 'z', kind: 'work', label: 'Zona 2', end: { by: 'durationSec', value: 900 }, target: { hrZone: 2 } }, cooldown]),
  ),
  // Repetição aninhada de verdade (o mapper de produção desenrola; aqui testamos se o relógio aceita).
  'nested-repeat': encode({
    name: 'Spike 2x(3x100)',
    rev: 'spike',
    steps: [
      { wktStepName: '200m', intensity: 'active', durationType: 'distance', durationValue: 20000, targetType: 'open' },
      { wktStepName: '100m', intensity: 'active', durationType: 'distance', durationValue: 10000, targetType: 'open' },
      { wktStepName: 'Trote', intensity: 'recovery', durationType: 'time', durationValue: 30000, targetType: 'open' },
      { durationType: 'repeatUntilStepsCmplt', durationValue: 1, targetValue: 3 },
      { durationType: 'repeatUntilStepsCmplt', durationValue: 0, targetValue: 2 },
    ],
  }),
  // Textos longos e acentuados sem passar pelo sanitizer: o que o relógio mostra ou corta?
  'long-names': encode({
    name: 'Spike nome bem comprido com acentuação ção',
    rev: 'spike',
    steps: [
      {
        wktStepName: 'Recuperação ativa com trote bem leve',
        notes: 'Notas longas: mantenha a postura, braços soltos, respiração controlada e pace confortável ×2 — ok',
        intensity: 'active',
        durationType: 'time',
        durationValue: 120000,
        targetType: 'open',
      },
    ],
  }),
  'protocol-20': withProtocol(encode({ ...intervals, name: 'Spike protocolo 2.0' }), 0x20),
  'protocol-02': withProtocol(encode({ ...intervals, name: 'Spike protocolo 0x02' }), 0x02),
};
for (let i = 1; i <= 30; i++) {
  const n = String(i).padStart(2, '0');
  fixtures[`cap-${n}`] = encode({ ...easy, name: `Spike cap ${n}` });
}

for (const [name, bytes] of Object.entries(fixtures)) {
  const decoder = new Decoder(Stream.fromByteArray(bytes));
  if (!decoder.isFIT() || !decoder.checkIntegrity()) throw new Error(`${name}: FIT inválido`);
  const { errors } = new Decoder(Stream.fromByteArray(bytes)).read();
  if (errors.length) throw new Error(`${name}: ${errors[0].message}`);
  writeFileSync(new URL(`${name}.fit`, out), bytes);
}
console.log(`${Object.keys(fixtures).length} fixtures em ${fileURLToPath(out)}`);
