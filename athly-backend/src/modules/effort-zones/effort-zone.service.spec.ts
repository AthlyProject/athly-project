import { EffortZoneService } from './effort-zone.service';
import type { RunDataForZones } from './types/effort-zone.types';

describe('EffortZoneService — cache de zonas', () => {
  const cachedZone = {
    vdotScore: 30,
    easyPaceMin: 420,
    easyPaceMax: 480,
    marathonPaceMin: 390,
    marathonPaceMax: 410,
    thresholdPaceMin: 370,
    thresholdPaceMax: 385,
    intervalPaceMin: 340,
    intervalPaceMax: 355,
    repetitionPaceMin: 320,
    repetitionPaceMax: 335,
    hrZones: null,
  };

  // Corrida 5km em 25min (pace 5:00) → VDOT bem acima dos 30 do cache.
  const freshRuns: RunDataForZones[] = [
    { distanceMeters: 5000, durationSeconds: 1500, averageHeartRate: null, maxHeartRate: null },
  ];

  function buildService() {
    const prisma = {
      userEffortZone: {
        findFirst: jest.fn().mockResolvedValue(cachedZone),
        // Prisma devolve null para JsonNull na leitura; corridas sem HR não geram hrZones.
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ ...data, hrZones: null })),
      },
    };
    return { service: new EffortZoneService(prisma as any), prisma };
  }

  it('recalcula quando há corridas novas, mesmo com cache válido', async () => {
    const { service, prisma } = buildService();
    const zones = await service.getOrCalculateForUser('u1', freshRuns, 'apple_health');

    expect(prisma.userEffortZone.findFirst).not.toHaveBeenCalled();
    expect(prisma.userEffortZone.create).toHaveBeenCalled();
    // VDOT do 5k em 25min (~38), não os 30 do cache antigo.
    expect(zones.vdotScore).toBeGreaterThan(35);
  });

  it('usa o cache quando a geração chega sem corridas (cold start)', async () => {
    const { service, prisma } = buildService();
    const zones = await service.getOrCalculateForUser('u1', [], 'apple_health');

    expect(prisma.userEffortZone.findFirst).toHaveBeenCalled();
    expect(prisma.userEffortZone.create).not.toHaveBeenCalled();
    expect(zones.vdotScore).toBe(30);
  });
});
