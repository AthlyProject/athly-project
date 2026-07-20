import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  calculateVdot,
  derivePaceZones,
  deriveHrZones,
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

    // Calculate HR zones if HR data available
    const hrRuns = runs.filter((r) => r.averageHeartRate && r.averageHeartRate > 0);
    const maxHrRuns = runs.filter((r) => r.maxHeartRate && r.maxHeartRate > 0);

    let hrZones: ReturnType<typeof deriveHrZones> | null = null;
    let maxHeartRate: number | null = null;
    let restHeartRate: number | null = null;

    if (maxHrRuns.length > 0 && hrRuns.length > 0) {
      maxHeartRate = Math.max(...maxHrRuns.map((r) => r.maxHeartRate!));
      const avgHR = hrRuns.reduce((sum, r) => sum + r.averageHeartRate!, 0) / hrRuns.length;
      restHeartRate = Math.round(avgHR * 0.45);
      restHeartRate = Math.max(40, Math.min(80, restHeartRate));
      hrZones = deriveHrZones(maxHeartRate, restHeartRate);
    }

    return {
      vdotScore: parseFloat(vdot.toFixed(1)),
      maxHeartRate,
      restHeartRate,
      dataSource,
      ...paceZones,
      hrZones,
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
    table += `| Zona | Nome | Pace alvo | Uso típico |\n`;
    table += `|------|------|-----------|------------|\n`;
    table += `| 1 | Easy/Recuperação | ${f(zone.easyPaceMin)}-${f(zone.easyPaceMax)}/km | Corridas de base (use a METADE MAIS RÁPIDA, perto de ${f(zone.easyPaceMin)}); extremo lento (${f(zone.easyPaceMax)}) só em dias de recuperação |\n`;
    table += `| 2 | Maratona | ${f(zone.marathonPaceMin)}-${f(zone.marathonPaceMax)}/km | Corridas longas, resistência |\n`;
    table += `| 3 | Limiar (Tempo) | ${f(zone.thresholdPaceMin)}-${f(zone.thresholdPaceMax)}/km | Tempo runs, limiar lático |\n`;
    table += `| 4 | Intervalos (VO2max) | ${f(zone.intervalPaceMin)}-${f(zone.intervalPaceMax)}/km | Intervalos, potência aeróbica máxima |\n`;
    table += `| 5 | Repetição | ${f(zone.repetitionPaceMin)}-${f(zone.repetitionPaceMax)}/km | Sprints, strides, economia de corrida |\n`;

    if (zone.hrZones) {
      const hr = typeof zone.hrZones === 'string' ? JSON.parse(zone.hrZones) : zone.hrZones;
      table += `\n| Zona | FC alvo |\n`;
      table += `|------|---------|\n`;
      table += `| 1 Easy | ${hr.zone1.min}-${hr.zone1.max} bpm |\n`;
      table += `| 2 Maratona | ${hr.zone2.min}-${hr.zone2.max} bpm |\n`;
      table += `| 3 Limiar | ${hr.zone3.min}-${hr.zone3.max} bpm |\n`;
      table += `| 4 Intervalos | ${hr.zone4.min}-${hr.zone4.max} bpm |\n`;
      table += `| 5 Repetição | ${hr.zone5.min}-${hr.zone5.max} bpm |\n`;
    }

    table += `</personalized_zones>`;

    return {
      formatted: table,
      vdotScore: zone.vdotScore ?? null,
    };
  }
}
