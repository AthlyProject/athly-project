import { preferPersistedExecutions } from './persisted-executions';
import { SegmentLabel, type DetailedSessionDto } from './dto/plan-from-health.dto';

// Caso real (prod, 04/11/2026): o sync do iPhone releu o Threshold Run sem a prescrição e a
// heurística de laps devolveu "rec, rec, rep, rep"; a conclusão tinha salvo 2,5 km de limiar.
const UUID = '9E7257C1-A1AB-4E29-A58C-7610F3F6CB9F';

const resynced = {
  startDate: '2026-11-04T15:35:00.000Z',
  appleHealthWorkoutUUID: UUID,
  athlyWorkoutId: 'ea7bd3d6',
  distanceMeters: 4035,
  durationSeconds: 1462,
  splitsSource: 'events',
  segments: [
    { label: SegmentLabel.rec, distanceKm: 0.15, durationSeconds: 69 },
    { label: SegmentLabel.rec, distanceKm: 0.89, durationSeconds: 401 },
    { label: SegmentLabel.rep, distanceKm: 0.99, durationSeconds: 303 },
    { label: SegmentLabel.rep, distanceKm: 1.01, durationSeconds: 323 },
    { label: SegmentLabel.cooldown, distanceKm: 1, durationSeconds: 366 },
  ],
} as DetailedSessionDto;

const completedDetail = {
  startDate: '2026-11-04T15:35:00.000Z',
  appleHealthWorkoutUUID: UUID,
  distanceMeters: 4008,
  durationSeconds: 1348,
  splitsSource: 'prescribed',
  segments: [
    { label: 'warmup', distanceKm: 1, durationSeconds: 371 },
    { label: 'tempo', distanceKm: 2.5, durationSeconds: 765, avgHR: 164 },
    { label: 'cooldown', distanceKm: 0.5, durationSeconds: 212 },
  ],
};

describe('preferPersistedExecutions', () => {
  it('usa a execução salva na conclusão no lugar da releitura do iPhone (UUID sem diferenciar caixa)', () => {
    const [session] = preferPersistedExecutions(
      [{ ...resynced, appleHealthWorkoutUUID: UUID.toLowerCase() }],
      [{ workoutId: 'ea7bd3d6', appleHealthWorkoutUUID: UUID, executionDetails: completedDetail }],
    );
    expect(session.splitsSource).toBe('prescribed');
    expect(session.segments.map((s) => s.label)).toEqual(['warmup', 'tempo', 'cooldown']);
    expect(session.athlyWorkoutId).toBe('ea7bd3d6');
  });

  it('mantém a sessão do iPhone quando não há execução salva válida da mesma corrida', () => {
    const other = { ...resynced, appleHealthWorkoutUUID: 'OTHER-UUID' } as DetailedSessionDto;
    const result = preferPersistedExecutions(
      [other, resynced],
      [
        {
          workoutId: 'ea7bd3d6',
          appleHealthWorkoutUUID: UUID,
          executionDetails: { segments: 'x' },
        },
      ],
    );
    expect(result).toEqual([other, resynced]);
  });

  it('sem UUID, casa pelo treino Athly vinculado', () => {
    const noUuid = { ...resynced, appleHealthWorkoutUUID: undefined } as DetailedSessionDto;
    const [session] = preferPersistedExecutions(
      [noUuid],
      [{ workoutId: 'ea7bd3d6', appleHealthWorkoutUUID: null, executionDetails: completedDetail }],
    );
    expect(session.splitsSource).toBe('prescribed');
  });
});
