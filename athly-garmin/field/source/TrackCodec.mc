import Toybox.Lang;

// Formato binário da rota, o mesmo que o backend lê (athly-backend/src/modules/connect-iq/
// activity/track-codec.ts). Cada ponto ocupa 13 bytes, big-endian:
//   0–3   segundos desde o início (int32)
//   4–7   latitude × 10⁷ (int32)
//   8–11  longitude × 10⁷ (int32)
//   12    frequência cardíaca em bpm (0 = sem FC)
module TrackCodec {
    const POINT_BYTES = 13;
    // 400 pontos (≈ 13 min a cada 2 s) = 5,2 KB: cabe com folga no Storage (32 KB por valor) e,
    // em base64, na memória do processo em segundo plano (64 KB).
    const POINTS_PER_BLOCK = 400;
    const BLOCK_BYTES = POINT_BYTES * POINTS_PER_BLOCK;

    function encodePoint(
        buffer as ByteArray,
        index as Number,
        offsetSec as Number,
        latitude as Double or Float,
        longitude as Double or Float,
        heartRate as Number?
    ) as Void {
        var at = index * POINT_BYTES;
        buffer.encodeNumber(offsetSec, Lang.NUMBER_FORMAT_SINT32, { :offset => at, :endianness => Lang.ENDIAN_BIG });
        buffer.encodeNumber(scaled(latitude), Lang.NUMBER_FORMAT_SINT32, { :offset => at + 4, :endianness => Lang.ENDIAN_BIG });
        buffer.encodeNumber(scaled(longitude), Lang.NUMBER_FORMAT_SINT32, { :offset => at + 8, :endianness => Lang.ENDIAN_BIG });
        buffer[at + 12] = clampHeartRate(heartRate);
    }

    function scaled(degrees as Double or Float) as Number {
        var value = degrees * 10000000;
        return (value < 0 ? value - 0.5 : value + 0.5).toNumber();
    }

    function clampHeartRate(heartRate as Number?) as Number {
        if (heartRate == null || heartRate <= 0) {
            return 0;
        }
        return heartRate > 255 ? 255 : heartRate;
    }
}
