import { decodeTrack, encodeTrack, isValidTrackBlock, TRACK_POINT_BYTES } from './track-codec';

describe('track-codec', () => {
  const points = [
    { offsetSec: 0, latitude: -23.5613891, longitude: -46.6565712, heartRate: 128 },
    { offsetSec: 2, latitude: -23.5614012, longitude: -46.6566001, heartRate: null },
  ];

  it('decodifica o formato de 13 bytes big-endian do campo de dados', () => {
    const data = Buffer.alloc(TRACK_POINT_BYTES);
    data.writeInt32BE(42, 0);
    data.writeInt32BE(-235613891, 4);
    data.writeInt32BE(-466565712, 8);
    data.writeUInt8(151, 12);

    expect(decodeTrack(data)).toEqual([
      { offsetSec: 42, latitude: -23.5613891, longitude: -46.6565712, heartRate: 151 },
    ]);
  });

  it('ida e volta preserva coordenadas com 7 casas', () => {
    expect(decodeTrack(encodeTrack(points))).toEqual(points);
  });

  it('descarta pontos sem posição (0, 0) e fora do globo', () => {
    const data = encodeTrack([
      { offsetSec: 0, latitude: 0, longitude: 0, heartRate: 120 },
      points[0],
    ]);
    // Latitude impossível (> 90°) escrita direto nos bytes.
    const broken = Buffer.concat([data, Buffer.alloc(TRACK_POINT_BYTES)]);
    broken.writeInt32BE(1_000_000_000, data.length + 4);
    broken.writeInt32BE(1, data.length + 8);

    expect(decodeTrack(broken)).toEqual([points[0]]);
  });

  it('aceita só blocos não vazios, múltiplos de 13 bytes e dentro do limite', () => {
    expect(isValidTrackBlock(Buffer.alloc(26), 100)).toBe(true);
    expect(isValidTrackBlock(Buffer.alloc(0), 100)).toBe(false);
    expect(isValidTrackBlock(Buffer.alloc(27), 100)).toBe(false);
    expect(isValidTrackBlock(Buffer.alloc(104), 100)).toBe(false);
  });
});
