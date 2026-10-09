import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  calculateVdot,
  derivePaceZones,
  findBestEffort,
  formatPace,
  DEFAULT_VDOT,
} from './vdot-calculator';
import type { EffortZoneData, RunDataForZones, FormattedZones } from './types/effort-zone.types';

@Injectable()
export class EffortZoneService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCalculateForUser(
    userId: string,
    runs?: RunDataForZones[],
    dataSource?: 'apple_health',
  ): Promise<FormattedZones> {
    // Com corridas novas, recalcula SEMPRE: o cálculo é matemática pura (custa
    // microssegundos) e zonas em cache viram pace prescrito defasado — a geração
    // de domingo podia reutilizar zonas da semana retrasada se caísse minutos antes
    // do validUntil. O cache cobre apenas gerações sem dados (cold start/assessment).
    const hasFreshRuns = (runs?.length ?? 0) > 0;
    if (!hasFreshRuns) {
      const existing = await this.prisma.userEffortZone.findFirst({
        where: {
          userId,
          validUntil: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        return this.formatForPrompt(existing);
      }
    }

    // Calculate new zones
    const zoneData = this.calculateFromRuns(runs ?? [], dataSource ?? 'apple_health');

    // Persist
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    const saved = await this.prisma.userEffortZone.create({
      data: {
        userId,
        ...zoneData,
        hrZones: (zoneData.hrZones ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        calculatedFrom: zoneData.calculatedFrom as unknown as Prisma.InputJsonValue,
        validUntil,
      },
    });

    return this.formatForPrompt(saved);
  }

  calculateFromRuns(
    runs: RunDataForZones[],
    dataSource: 'apple_health' | 'assessment',
  ): EffortZoneData {
    const bestEffort = findBestEffort(runs);

    let vdot: number;
    let bestEffortMeta: { distanceKm: number; pace: string; durationMin: number };

    if (bestEffort) {
      vdot = calculateVdot(bestEffort.distanceMeters, bestEffort.durationSeconds);
      // Clamp VDOT to reasonable range (20-85)
      vdot = Math.max(20, Math.min(85, vdot));
      bestEffortMeta = {
        distanceKm: parseFloat((bestEffort.distanceMeters / 1000).toFixed(2)),
        pace: formatPace((bestEffort.durationSeconds / bestEffort.distanceMeters) * 1000),
        durationMin: parseFloat((bestEffort.durationSeconds / 60).toFixed(1)),
      };
    } else {
      vdot = DEFAULT_VDOT;
      bestEffortMeta = { distanceKm: 0, pace: 'N/A', durationMin: 0 };
    }

    const paceZones = derivePaceZones(vdot);

    return {
      vdotScore: parseFloat(vdot.toFixed(1)),
      maxHeartRate: null,
      restHeartRate: null,
      dataSource,
      ...paceZones,
      hrZones: null,
      calculatedFrom: {
        runCount: runs.length,
        bestEffortDistanceKm: bestEffortMeta.distanceKm,
        bestEffortPace: bestEffortMeta.pace,
        bestEffortDurationMin: bestEffortMeta.durationMin,
        calculatedAt: new Date().toISOString(),
      },
    };
  }

  formatForPrompt(zone: any): FormattedZones {
    const f = (sec: number) => formatPace(sec);

    let table = `<personalized_zones>\nVDOT estimado: ${zone.vdotScore ?? 'N/A'}\n\n`;
    table += `| Categoria de ritmo (não é zona de FC) | Nome | Pace alvo | Uso típico |\n`;
    table += `|------|------|-----------|------------|\n`;
    table += `| 1 | Easy/Recuperação | ${f(zone.easyPaceMin)}-${f(zone.easyPaceMax)}/km | Corridas de base (use a METADE MAIS RÁPIDA, perto de ${f(zone.easyPaceMin)}); extremo lento (${f(zone.easyPaceMax)}) só em dias de recuperação |\n`;
    table += `| 2 | Maratona | ${f(zone.marathonPaceMin)}-${f(zone.marathonPaceMax)}/km | Corridas longas, resistência |\n`;
    table += `| 3 | Limiar (Tempo) | ${f(zone.thresholdPaceMin)}-${f(zone.thresholdPaceMax)}/km | Tempo runs, limiar lático |\n`;
    table += `| 4 | Intervalos (VO2max) | ${f(zone.intervalPaceMin)}-${f(zone.intervalPaceMax)}/km | Intervalos, potência aeróbica máxima |\n`;
    table += `| 5 | Repetição | ${f(zone.repetitionPaceMin)}-${f(zone.repetitionPaceMax)}/km | Sprints, strides, economia de corrida |\n`;

    table += `</personalized_zones>`;

    return {
      formatted: table,
      vdotScore: zone.vdotScore ?? null,
    };
  }
}
