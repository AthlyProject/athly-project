/**
 * Formato binário da rota gravada pelo campo de dados (`athly-garmin/field/source/Track.mc`).
 * Cada ponto ocupa 13 bytes, big-endian:
 *
 * | bytes | campo                                  |
 * |-------|----------------------------------------|
 * | 0–3   | segundos desde o início (int32)        |
 * | 4–7   | latitude × 10⁷ (int32)                 |
 * | 8–11  | longitude × 10⁷ (int32)                |
 * | 12    | frequência cardíaca em bpm (0 = sem FC) |
 */
export const TRACK_POINT_BYTES = 13;
const COORD_SCALE = 1e7;

export interface TrackPoint {
  offsetSec: number;
  latitude: number;
  longitude: number;
  heartRate: number | null;
}

/** Tamanho aceitável para um bloco: não vazio e múltiplo exato do tamanho do ponto. */
export function isValidTrackBlock(data: Buffer, maxBytes: number): boolean {
  return data.length > 0 && data.length <= maxBytes && data.length % TRACK_POINT_BYTES === 0;
}

/** Decodifica um bloco; descarta pontos fora do globo ou em (0, 0) — GPS ainda sem posição. */
export function decodeTrack(data: Buffer): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (let offset = 0; offset + TRACK_POINT_BYTES <= data.length; offset += TRACK_POINT_BYTES) {
    const latitude = data.readInt32BE(offset + 4) / COORD_SCALE;
    const longitude = data.readInt32BE(offset + 8) / COORD_SCALE;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    if (latitude === 0 && longitude === 0) continue;
    const heartRate = data.readUInt8(offset + 12);
    points.push({
      offsetSec: data.readInt32BE(offset),
      latitude,
      longitude,
      heartRate: heartRate > 0 ? heartRate : null,
    });
  }
  return points;
}

/** Inverso de `decodeTrack` — usado nos testes e nas fixtures do simulador. */
export function encodeTrack(points: TrackPoint[]): Buffer {
  const data = Buffer.alloc(points.length * TRACK_POINT_BYTES);
  points.forEach((point, index) => {
    const offset = index * TRACK_POINT_BYTES;
    data.writeInt32BE(point.offsetSec, offset);
    data.writeInt32BE(Math.round(point.latitude * COORD_SCALE), offset + 4);
    data.writeInt32BE(Math.round(point.longitude * COORD_SCALE), offset + 8);
    data.writeUInt8(point.heartRate ?? 0, offset + 12);
  });
  return data;
}
