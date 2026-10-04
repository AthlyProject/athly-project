import { CrcCalculator, Encoder, Profile } from '@garmin/fitsdk';
import type { FileIdMesg, WorkoutMesg, WorkoutStepMesg } from '@garmin/fitsdk';
import { FIT_PRODUCT_ID, FIT_PROTOCOL_VERSION } from './fit.constants';
import type { FitWorkoutPlan } from './workout-fit-plan';

const HEADER_SIZE = 14;
const HEADER_CRC_OFFSET = 12;

/** Remove chaves `undefined`: o encoder define os campos a partir das chaves presentes. */
const compact = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

/**
 * Reescreve o byte de versão do protocolo no cabeçalho e recalcula os dois CRCs (cabeçalho e
 * arquivo — o CRC final cobre o cabeçalho).
 */
function withProtocolVersion(bytes: Uint8Array, version: number): Uint8Array {
  const out = Uint8Array.from(bytes);
  out[1] = version;
  const view = new DataView(out.buffer);
  view.setUint16(HEADER_CRC_OFFSET, CrcCalculator.calculateCRC(out, 0, HEADER_CRC_OFFSET), true);
  view.setUint16(out.length - 2, CrcCalculator.calculateCRC(out, 0, out.length - 2), true);
  return out;
}

/**
 * Arquivo FIT de treino (`file_id` + `workout` + `workout_step`s) pronto para o relógio baixar
 * como treino nativo. `serialNumber` identifica o arquivo junto com manufacturer/product.
 */
export function encodeWorkoutFit(
  plan: FitWorkoutPlan,
  options: { serialNumber: number; timeCreated: Date },
): Uint8Array {
  const fileId: FileIdMesg = {
    type: 'workout',
    manufacturer: 'development',
    product: FIT_PRODUCT_ID,
    serialNumber: options.serialNumber,
    timeCreated: options.timeCreated,
  };
  const workout: WorkoutMesg = {
    wktName: plan.name,
    sport: 'running',
    subSport: 'generic',
    numValidSteps: plan.steps.length,
  };
  const encoder = new Encoder();
  encoder.onMesg(Profile.MesgNum.FILE_ID, fileId);
  encoder.onMesg(Profile.MesgNum.WORKOUT, workout);
  plan.steps.forEach((step, messageIndex) => {
    const mesg: WorkoutStepMesg = compact({ messageIndex, ...step });
    encoder.onMesg(Profile.MesgNum.WORKOUT_STEP, mesg);
  });
  const bytes = encoder.close();
  if (bytes.length < HEADER_SIZE + 2) throw new Error('FIT encoder returned a truncated file');
  return withProtocolVersion(bytes, FIT_PROTOCOL_VERSION);
}

/** Serial do arquivo a partir do UUID do treino (uint32z: 0 é inválido). */
export function fitSerialNumber(workoutId: string): number {
  const serial = Number.parseInt(workoutId.replace(/-/g, '').slice(0, 8), 16);
  return Number.isFinite(serial) && serial > 0 ? serial : 1;
}
