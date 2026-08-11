import { Injectable, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  PlanGenerationStatus,
  Prisma,
  SportType,
  TrainingPlanStatus,
  WeeklyGoalStatus,
  WorkoutStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GeminiService } from './gemini.service';
import { EffortZoneService } from '../effort-zones/effort-zone.service';
import { AssessmentService } from '../assessment/assessment.service';
import { WorkoutExecutionAnalyzerService } from './workout-execution-analyzer.service';
import { PlanFromHealthDto, DetailedSessionDto, SegmentLabel } from './dto/plan-from-health.dto';
import type {
  AiPlannerInput,
  PlannerGuardrails,
  PreviousWeekAnalysis,
  RunAnalysis,
  RunSummary,
} from './types/planner.types';
import type { RunDataForZones } from '../effort-zones/types/effort-zone.types';
import type { ParsedGoal } from './prompts/goal-parser-prompt';
import type {
  DeterministicPlannerContext,
  GoalAttemptContext,
  UserProfileContext,
  LongitudinalWeek,
} from './prompts/planner-prompt';
import { buildMacrocycle, type PlannedWeek } from './periodization';
import {
  assessGoalFeasibility,
  parseTargetDistanceMeters,
  parseTargetTimeSeconds,
} from './goal-feasibility';
import { computeLongitudinalWeeks, computePreviousWeekAnalysis } from './weekly-metrics.util';
import { TrainingReportService } from '../training-report/training-report.service';
import { flattenToLegacyBlocks } from '../workouts/utils/flatten-to-legacy';
import { SEGMENT_SCHEMA_VERSION } from '../workouts/types/segment.types';

const PROMPT_VERSION = 'v3.1';
const DETAILED_FIRST_GEN = 5;
const DETAILED_MID_PLAN = 7;
const HISTORICAL_FIRST_GEN = 20;
const LONGITUDINAL_WEEKS = 4;

// Piso de distância para um esforço entrar como candidato a "melhor esforço" do VDOT.
// Esforços curtos demais rodam em regime supramáximo e distorcem a estimativa.
const MIN_EFFORT_METERS = 1500;
// Tiros são corridos QUEBRADOS por recuperação; um esforço contínuo no mesmo pace não é
// sustentável. Penaliza ~5% a duração-equivalente do bloco de tiros para não superestimar
// o VDOT ao tratá-lo como se fosse uma corrida contínua. Knob de calibração — validar
// contra tabelas de Daniels antes de mexer.
const REP_EFFORT_PENALTY = 1.05;

const DEFAULT_AVAILABLE_DAYS = ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'];
const GENERATION_POLL_AFTER_SECONDS = 5;
const GENERATION_MAX_ATTEMPTS = 3;
const GENERATION_LEASE_MS = 15 * 60 * 1000;
const GENERATION_RETRY_DELAY_MS = 30 * 1000;

type PlanningWindow = {
  weekDates: string[];
  weekStartDate: Date;
  weekEndDate: Date;
  availableDays: string[];
  trainingDays: number;
  minTrainingDate?: string;
};

@Injectable()
export class AiPlannerService {
  private readonly logger = new Logger(AiPlannerService.name);
  private readonly workerId = randomUUID();
  private generationDrainRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly effortZoneService: EffortZoneService,
    private readonly assessmentService: AssessmentService,
    private readonly executionAnalyzer: WorkoutExecutionAnalyzerService,
    private readonly trainingReportService: TrainingReportService,
  ) {}

  async planFromHealth(userId: string, input: PlanFromHealthDto, generationId?: string) {
    // Fetch active goal and assessment for context (before creating training plan)
    const [activeGoalRecord, assessmentRecord, userHealth] = await Promise.all([
      this.prisma.userGoal.findFirst({
        where: { userId, active: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.assessmentService.findByUser(userId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { availableDays: true } }),
    ]);
    const activeGoal = activeGoalRecord
      ? (activeGoalRecord.parsedGoal as unknown as ParsedGoal)
      : null;
    const userProfile = assessmentRecord ? this.buildUserProfile(assessmentRecord.answers) : null;
    const baseAvailableDays = userHealth?.availableDays?.length
      ? userHealth.availableDays
      : DEFAULT_AVAILABLE_DAYS;
    const planningWindow = this.resolvePlanningWindow(input.weekStartDate, baseAvailableDays);
    const { weekDates, weekStartDate, weekEndDate, availableDays, trainingDays, minTrainingDate } =
      planningWindow;

    const trainingPlan = await this.resolveTrainingPlan(
      userId,
      weekDates[0],
      activeGoalRecord?.id,
      activeGoal?.summary,
      activeGoal?.eventDate,
    );
    if (generationId) {
      await this.prisma.planGenerationJob.update({
        where: { id: generationId },
        data: { trainingPlanId: trainingPlan.id },
      });
    }

    // Read the current week's PLANNED skeleton row (phase/targets) BEFORE
    // checkWeekOverlap deletes it, so dated-goal context survives the overwrite.
    const plannedCurrentRow = await this.prisma.weeklyGoal.findFirst({
      where: {
        trainingPlanId: trainingPlan.id,
        status: WeeklyGoalStatus.PLANNED,
        weekStartDate: { lte: weekEndDate },
        weekEndDate: { gte: weekStartDate },
      },
      select: { metrics: true },
    });

    await this.checkWeekOverlap(trainingPlan.id, weekStartDate, weekEndDate);

    // Calculate effort zones from health runs. O pace médio de corrida inteira inclui
    // aquecimento/volta à calma e subestima o VDOT — por isso também entram como
    // candidatos os melhores sub-esforços contínuos (janelas de splits reais) das
    // sessões detalhadas.
    const runsForZones: RunDataForZones[] = [
      ...input.runs.map((r) => ({
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
        averageHeartRate: null,
        maxHeartRate: null,
      })),
      ...this.bestSubEffortsFromSessions(input.detailedSessions ?? []),
    ];
    const effortZones = await this.effortZoneService.getOrCalculateForUser(
      userId,
      runsForZones,
      'apple_health',
    );

    const detailedSessionsForMetrics = input.detailedSessions ?? [];

    // Build previous week analysis
    const previousWeekAnalysis = await this.buildPreviousWeekAnalysis(
      trainingPlan.id,
      weekStartDate,
      detailedSessionsForMetrics,
    );
    const isFirstGeneration = previousWeekAnalysis === null;

    // Slice historical runs per generation-context budget.
    const historicalRuns = isFirstGeneration
      ? input.runs.slice(0, HISTORICAL_FIRST_GEN)
      : input.runs.slice(0, Math.min(input.runs.length, 3));

    // Detailed sessions (executed intervals/tempos with segments + HR) get mastigated server-side.
    const detailedInput = (input.detailedSessions ?? []).slice(
      0,
      isFirstGeneration ? DETAILED_FIRST_GEN : DETAILED_MID_PLAN,
    );
    const analyzedSessions = await this.executionAnalyzer.analyzeSessions(userId, detailedInput, {
      trainingPlanId: trainingPlan.id,
      beforeDate: weekStartDate,
      persistedLimit: isFirstGeneration ? DETAILED_FIRST_GEN : DETAILED_MID_PLAN,
    });

    // Longitudinal trend only makes sense mid-plan (requires prior WeeklyGoal metrics).
    const longitudinalWeeks = isFirstGeneration
      ? undefined
      : await this.buildLongitudinalTrend(
          trainingPlan.id,
          weekStartDate,
          detailedSessionsForMetrics,
        );

    // Cold start: sem corridas no Apple Health → plano de avaliação (mesmo prompt do
    // antigo fluxo sem histórico, agora sob o único endpoint plan-from-health).
    const isAssessment = input.runs.length === 0;
    const aiInput = this.buildAiInputFromHealthRuns(
      historicalRuns,
      weekDates,
      trainingDays,
      availableDays,
      minTrainingDate,
    );

    // Dated-goal periodization: derive the current week's phase/targets and lay out
    // (or extend) the future PLANNED skeleton up to the event. Also refresh the goal's
    // feasibility snapshot with the freshest VDOT.
    const currentWeeklyVolumeKm =
      aiInput.avgDistKm > 0 ? aiInput.avgDistKm * trainingDays : trainingDays * 4;
    const plannedWeek = await this.resolveCurrentPlannedWeek({
      trainingPlanId: trainingPlan.id,
      startDateISO: trainingPlan.startDate,
      weekStartISO: weekDates[0],
      weekEndDate,
      goal: activeGoal,
      currentWeeklyVolumeKm,
      preReadMetrics: plannedCurrentRow?.metrics ?? null,
    });
    await this.refreshGoalFeasibility(
      activeGoalRecord?.id,
      activeGoal,
      effortZones.vdotScore,
      weekDates[0],
    );

    // Continuidade entre planos: um plano novo não tem semanas próprias (cold start).
    // Se houver um laudo do plano anterior, usamos seu contexto APENAS no prompt —
    // sem alterar isFirstGeneration (o slicing de runs/sessões segue o do cold start).
    let promptPreviousWeek = previousWeekAnalysis;
    let promptLongitudinal = longitudinalWeeks;
    let laudoContextNote: string | undefined;
    let laudoConsumed = false;
    if (
      !isAssessment &&
      !previousWeekAnalysis &&
      (!longitudinalWeeks || longitudinalWeeks.length === 0)
    ) {
      const report = await this.trainingReportService.getForUser(userId);
      if (report) {
        promptLongitudinal = report.longitudinalWeeks?.length
          ? report.longitudinalWeeks
          : undefined;
        promptPreviousWeek = report.previousWeekAnalysis ?? null;
        laudoContextNote = report.objective
          ? `Contexto do plano ANTERIOR (laudo, recém-encerrado): o atleta vinha treinando para "${report.objective}". As semanas e a "semana anterior" abaixo são desse período — use como linha de base de aderência/volume/tendência ao planejar o novo ciclo.`
          : undefined;
        laudoConsumed = true;
      }
    }

    const deterministicContext = this.buildDeterministicContext(
      aiInput,
      promptPreviousWeek,
      activeGoal,
      analyzedSessions,
      promptLongitudinal,
    );
    const plannerGuardrails = this.buildPlannerGuardrails(
      aiInput,
      deterministicContext,
      promptLongitudinal,
      minTrainingDate,
    );

    // Reserva o slot da semana ANTES da chamada lenta do Gemini. Com a unique constraint
    // (trainingPlanId, weekStartDate), um duplo-submit concorrente recebe ConflictException
    // em vez de criar uma segunda semana sobreposta.
    const reservedWeeklyGoal = await this.reserveWeeklyGoal(
      trainingPlan.id,
      weekStartDate,
      weekEndDate,
    );

    const plannerResult = await (
      isAssessment
        ? this.geminiService.generateAssessmentPlan(
            weekDates,
            trainingDays,
            availableDays,
            effortZones,
            activeGoal,
            userProfile,
            analyzedSessions,
            minTrainingDate,
          )
        : this.geminiService.generatePlan(
            aiInput,
            effortZones,
            promptPreviousWeek,
            activeGoal,
            userProfile,
            analyzedSessions,
            promptLongitudinal,
            plannedWeek,
            laudoContextNote,
            plannerGuardrails,
            deterministicContext,
          )
    ).catch(async (err) => {
      // Gemini falhou ou reprovou no gate de estrutura → libera o slot reservado.
      await this.releaseReservation(reservedWeeklyGoal.id);
      throw err;
    });

    const { weeklyGoal, workouts } = await this.prisma
      .$transaction(async (tx) => {
        // Atualiza o placeholder reservado (não cria nova weekly_goal) — a reserva já garantiu unicidade.
        const weeklyGoal = await tx.weeklyGoal.update({
          where: { id: reservedWeeklyGoal.id },
          data: {
            status: WeeklyGoalStatus.GENERATED,
            metrics: plannerResult.parsed.analysis as unknown as Prisma.InputJsonValue,
            previousWeekAnalysis: previousWeekAnalysis
              ? (previousWeekAnalysis as unknown as Prisma.InputJsonValue)
              : undefined,
          },
        });

        const workouts = await Promise.all(
          plannerResult.parsed.weekPlan.map((day) =>
            tx.workout.create({
              data: {
                trainingPlanId: trainingPlan.id,
                weeklyGoalId: weeklyGoal.id,
                userId,
                dateScheduled: new Date(day.date),
                sportType: day.sportType,
                title: day.title,
                description: day.description,
                blocks: this.deriveBlocksForPersistence(day) as unknown as Prisma.InputJsonValue,
                segments: {
                  schemaVersion: SEGMENT_SCHEMA_VERSION,
                  sport: day.sportType,
                  segments: day.segments ?? [],
                } as unknown as Prisma.InputJsonValue,
                status: WorkoutStatus.scheduled,
                intensity: day.intensity,
                isGoalAttempt: day.isGoalAttempt ?? false,
              },
            }),
          ),
        );

        // Persist AI reasoning
        await Promise.all(
          plannerResult.parsed.weekPlan.map(async (day, idx) => {
            if (day.reasoning && day.sportType !== 'other') {
              await tx.aiReasoning.create({
                data: {
                  workoutId: workouts[idx].id,
                  weeklyGoalId: weeklyGoal.id,
                  justification: day.reasoning,
                  dataPointsUsed: {
                    avgPace: plannerResult.parsed.analysis.avgPace,
                    totalDistanceKm: plannerResult.parsed.analysis.totalDistanceKm,
                    vdotScore: effortZones.vdotScore,
                    trend: plannerResult.parsed.analysis.trend,
                  } as unknown as Prisma.InputJsonValue,
                  promptVersion: PROMPT_VERSION,
                  modelUsed: plannerResult.modelUsed,
                },
              });
            } else if (day.sportType !== 'other' && !day.reasoning) {
              this.logger.warn(`Workout "${day.title}" on ${day.date} missing AI reasoning`);
            }
          }),
        );

        await tx.aiPlannerPromptLog.create({
          data: {
            weeklyGoalId: weeklyGoal.id,
            generationType: isAssessment ? 'assessment' : 'planner',
            promptVersion: PROMPT_VERSION,
            modelUsed: plannerResult.modelUsed,
            promptText: plannerResult.prompt,
            rawResponse: plannerResult.rawResponse,
            parsedResponse: {
              ...plannerResult.parsed,
              aiUsage: plannerResult.usage,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        if (generationId) {
          const result = {
            trainingPlanId: trainingPlan.id,
            weeklyGoalId: weeklyGoal.id,
            workoutIds: workouts.map((workout) => workout.id),
          };
          await tx.planGenerationJob.update({
            where: { id: generationId },
            data: {
              status: PlanGenerationStatus.COMPLETED,
              result: result as Prisma.InputJsonValue,
              payload: {} as Prisma.InputJsonValue,
              weeklyGoalId: weeklyGoal.id,
              workoutIds: result.workoutIds,
              error: null,
              leaseOwner: null,
              leaseExpiresAt: null,
              completedAt: new Date(),
            },
          });

          const devices = await tx.pushDevice.findMany({
            where: { userId, disabledAt: null },
            select: { id: true },
          });
          if (devices.length > 0) {
            await tx.pushDelivery.createMany({
              data: devices.map((device) => ({
                generationId,
                deviceId: device.id,
              })),
              skipDuplicates: true,
            });
          }
        }

        return { weeklyGoal, workouts };
      })
      .catch(async (err) => {
        // Falha ao persistir após reservar → libera o slot para nova tentativa.
        await this.releaseReservation(reservedWeeklyGoal.id);
        throw err;
      });

    // Laudo consumido com sucesso (consume-once) — limpa para não brifar planos futuros com dados velhos.
    if (laudoConsumed) {
      await this.trainingReportService
        .clearForUser(userId)
        .catch((e) => this.logger.warn(`Failed to clear training report for user ${userId}: ${e}`));
    }

    return {
      trainingPlan: { id: trainingPlan.id, status: trainingPlan.status as any },
      weeklyGoal: {
        id: weeklyGoal.id,
        trainingPlanId: weeklyGoal.trainingPlanId,
        weekStartDate: weeklyGoal.weekStartDate,
        weekEndDate: weeklyGoal.weekEndDate,
        status: weeklyGoal.status as any,
        metrics: weeklyGoal.metrics as any,
        previousWeekAnalysis: weeklyGoal.previousWeekAnalysis as any,
        createdAt: weeklyGoal.createdAt,
        updatedAt: weeklyGoal.updatedAt,
      },
      workouts: workouts.map((w) => ({
        id: w.id,
        date: w.dateScheduled.toISOString().split('T')[0],
        sportType: w.sportType as any,
        title: w.title,
        description: w.description ?? undefined,
        blocks: w.blocks as any,
        status: w.status as any,
        intensity: w.intensity ?? undefined,
        trainingPlanId: w.trainingPlanId,
        weeklyGoalId: w.weeklyGoalId ?? undefined,
        stravaActivityId: w.stravaActivityId ?? null,
      })),
      analysis: plannerResult.parsed.analysis,
      aiUsage: plannerResult.usage,
      isAssessment,
    };
  }

  async startPlanFromHealthGeneration(userId: string, input: PlanFromHealthDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { availableDays: true },
    });
    const planningWindow = this.resolvePlanningWindow(
      input.weekStartDate,
      user?.availableDays?.length ? user.availableDays : DEFAULT_AVAILABLE_DAYS,
    );
    const key = {
      userId_weekStartDate: { userId, weekStartDate: planningWindow.weekStartDate },
    };
    const existing = await this.prisma.planGenerationJob.findUnique({ where: key });
    const job = existing
      ? existing.status === PlanGenerationStatus.FAILED
        ? await this.prisma.planGenerationJob.update({
            where: { id: existing.id },
            data: {
              status: PlanGenerationStatus.QUEUED,
              payload: input as unknown as Prisma.InputJsonValue,
              result: Prisma.JsonNull,
              weeklyGoalId: null,
              workoutIds: [],
              error: null,
              attempts: 0,
              leaseOwner: null,
              leaseExpiresAt: null,
              completedAt: null,
            },
          })
        : existing
      : await this.prisma.planGenerationJob.create({
          data: {
            userId,
            weekStartDate: planningWindow.weekStartDate,
            payload: input as unknown as Prisma.InputJsonValue,
          },
        });

    queueMicrotask(() => {
      void this.drainGenerationQueue().catch((error) =>
        this.logger.error(
          `Falha ao iniciar worker de geração: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    });
    return this.serializeGenerationJob(job);
  }

  async getPlanFromHealthGenerationStatus(userId: string, generationId: string) {
    const job = await this.prisma.planGenerationJob.findFirst({
      where: { id: generationId, userId },
    });
    if (!job) {
      throw new NotFoundException('Geração não encontrada');
    }

    return this.serializeGenerationJob(job);
  }

  async drainGenerationQueue(): Promise<void> {
    if (this.generationDrainRunning) return;
    this.generationDrainRunning = true;
    try {
      while (await this.processNextGenerationJob()) {
        // Drena a fila localmente; leases tornam isto seguro entre várias instâncias.
      }
    } finally {
      this.generationDrainRunning = false;
    }
  }

  private async processNextGenerationJob(): Promise<boolean> {
    const now = new Date();
    const candidate = await this.prisma.planGenerationJob.findFirst({
      where: {
        attempts: { lt: GENERATION_MAX_ATTEMPTS },
        OR: [
          {
            status: PlanGenerationStatus.QUEUED,
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
          },
          {
            status: PlanGenerationStatus.PROCESSING,
            leaseExpiresAt: { lt: now },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return false;

    const leaseOwner = `${this.workerId}:${candidate.id}`;
    const leaseExpiresAt = new Date(Date.now() + GENERATION_LEASE_MS);
    const claimed = await this.prisma.planGenerationJob.updateMany({
      where: {
        id: candidate.id,
        attempts: { lt: GENERATION_MAX_ATTEMPTS },
        OR: [
          {
            status: PlanGenerationStatus.QUEUED,
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
          },
          {
            status: PlanGenerationStatus.PROCESSING,
            leaseExpiresAt: { lt: now },
          },
        ],
      },
      data: {
        status: PlanGenerationStatus.PROCESSING,
        attempts: { increment: 1 },
        leaseOwner,
        leaseExpiresAt,
        error: null,
      },
    });
    if (claimed.count === 0) return true;

    const job = await this.prisma.planGenerationJob.findUniqueOrThrow({
      where: { id: candidate.id },
    });
    const heartbeat = setInterval(() => {
      void this.prisma.planGenerationJob
        .updateMany({
          where: { id: job.id, status: PlanGenerationStatus.PROCESSING, leaseOwner },
          data: { leaseExpiresAt: new Date(Date.now() + GENERATION_LEASE_MS) },
        })
        .catch((error) =>
          this.logger.warn(
            `Falha no heartbeat da geração ${job.id}: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
    }, 60_000);
    heartbeat.unref();

    try {
      await this.planFromHealth(
        job.userId,
        job.payload as unknown as PlanFromHealthDto,
        job.id,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const canRetry = job.attempts < GENERATION_MAX_ATTEMPTS && !(err instanceof ConflictException);
      await this.prisma.planGenerationJob.updateMany({
        where: { id: job.id, status: PlanGenerationStatus.PROCESSING, leaseOwner },
        data: canRetry
          ? {
              status: PlanGenerationStatus.QUEUED,
              error: message,
              leaseOwner: null,
              leaseExpiresAt: new Date(Date.now() + GENERATION_RETRY_DELAY_MS),
            }
          : {
              status: PlanGenerationStatus.FAILED,
              error: message,
              leaseOwner: null,
              leaseExpiresAt: null,
            },
      });
      this.logger.error(`Async weekly plan generation failed for user ${job.userId}: ${message}`);
    } finally {
      clearInterval(heartbeat);
    }
    return true;
  }

  private serializeGenerationJob(job: {
    id: string;
    status: PlanGenerationStatus;
    error: string | null;
    weeklyGoalId: string | null;
    workoutIds: string[];
  }) {
    const status = job.status.toLowerCase();
    const completed = job.status === PlanGenerationStatus.COMPLETED;
    const failed = job.status === PlanGenerationStatus.FAILED;

    return {
      generationId: job.id,
      status,
      pollAfterSeconds: GENERATION_POLL_AFTER_SECONDS,
      message: completed
        ? 'A semana foi gerada com sucesso.'
        : failed
          ? 'Não foi possível gerar a semana.'
          : 'A geração da semana está em andamento.',
      error: job.error ?? undefined,
      weeklyGoalId: job.weeklyGoalId ?? undefined,
      workoutIds: job.workoutIds,
    };
  }

  private buildUserProfile(answers: any): UserProfileContext {
    const parqFlagMap: Record<string, string> = {
      heartCondition: 'Condição cardíaca diagnosticada por médico',
      chestPainDuringActivity: 'Dor no peito durante atividade física',
      chestPainLastMonth: 'Dor no peito no último mês',
      dizzinessOrLossOfConsciousness: 'Tonturas ou perda de consciência',
      boneJointProblem: 'Problema ósseo ou articular que piora com exercício',
      takingBloodPressureMeds: 'Medicação para pressão arterial',
      otherReasonToAvoidExercise: 'Outro motivo para evitar exercício físico',
    };

    const parqFlags: string[] = [];
    if (answers?.parq) {
      for (const [key, label] of Object.entries(parqFlagMap)) {
        if (answers.parq[key] === true) parqFlags.push(label);
      }
    }

    return {
      sleepQuality: answers?.performanceHealth?.sleepQuality,
      hasChronicPain: answers?.performanceHealth?.hasChronicPain === 'yes',
      chronicPainDescription: answers?.performanceHealth?.chronicPainDescription,
      canRun3km: answers?.activityHistory?.canRun3km,
      runningExperience: answers?.activityHistory?.runningExperience,
      motivations: answers?.goals?.motivations,
      parqFlags,
    };
  }

  private async buildPreviousWeekAnalysis(
    trainingPlanId: string,
    currentWeekStart: Date,
    detailedSessions: DetailedSessionDto[] = [],
  ): Promise<PreviousWeekAnalysis | null> {
    // As duas semanas mais recentes antes da atual: a anterior (analisada) e a
    // retrasada (baseline do volumeChange). Comparar executado × executado — o
    // metrics.totalDistanceKm da própria goal é a soma das corridas de ENTRADA da
    // geração e fabricava "reduziu 75%".
    const recentGoals = await this.prisma.weeklyGoal.findMany({
      where: {
        trainingPlanId,
        weekEndDate: { lt: currentWeekStart },
      },
      orderBy: { weekStartDate: 'desc' },
      take: 2,
      include: {
        workouts: {
          include: {
            feedback: true,
          },
        },
      },
    });

    // recentGoals[0] = semana anterior (analisada); [1] = baseline do volumeChange.
    return computePreviousWeekAnalysis(recentGoals, { detailedSessions });
  }

  private buildDeterministicContext(
    input: AiPlannerInput,
    previousWeek: PreviousWeekAnalysis | null | undefined,
    goal: ParsedGoal | null,
    analyzedSessions: Awaited<ReturnType<WorkoutExecutionAnalyzerService['analyzeSessions']>>,
    longitudinalWeeks?: LongitudinalWeek[],
  ): DeterministicPlannerContext {
    const fallbackBaseline =
      input.avgDistKm > 0 ? input.avgDistKm * Math.max(1, input.trainingDays) : input.totalDistKm;
    const prevWeekKm =
      previousWeek?.totalDistanceKm && previousWeek.totalDistanceKm > 0
        ? previousWeek.totalDistanceKm
        : null;

    // Uma única semana ruim não pode colapsar a base: sem este piso, um atleta vindo de
    // 16/9/9 km que completou só 4.55 km na última semana recebia teto de ~5 km e um plano
    // degenerado (1 sessão em 4 dias disponíveis). Piso = 70% da média das últimas 3-4
    // semanas com volume registrado.
    const trailingWeeks = (longitudinalWeeks ?? []).filter((w) => w.totalKm > 0).slice(-4);
    const trailingAvgKm =
      trailingWeeks.length >= 2
        ? trailingWeeks.reduce((sum, w) => sum + w.totalKm, 0) / trailingWeeks.length
        : null;

    let baselineKm = prevWeekKm ?? fallbackBaseline;
    let baselineRaisedByTrailingFloor = false;
    if (trailingAvgKm !== null && baselineKm < trailingAvgKm * 0.7) {
      baselineKm = trailingAvgKm * 0.7;
      baselineRaisedByTrailingFloor = true;
    }

    const weeklyVolumeBaselineKm = round2(baselineKm);
    const weeklyVolumeMaxKm = round2(Math.max(weeklyVolumeBaselineKm, 0) * 1.1);

    // Base reconstruída pelo piso móvel — ou medida numa semana com <2 sessões
    // completadas — não merece confiança 'high' (que autoriza progressão agressiva).
    let volumeConfidence = previousWeek?.volumeConfidence ?? 'high';
    const completedWorkouts = previousWeek?.completedWorkouts ?? null;
    if (
      volumeConfidence === 'high' &&
      (baselineRaisedByTrailingFloor || (completedWorkouts !== null && completedWorkouts < 2))
    ) {
      volumeConfidence = 'low';
    }

    return {
      weeklyVolumeBaselineKm,
      weeklyVolumeMaxKm,
      volumeConfidence,
      goalAttempt: this.assessUndatedGoalAttempt(
        goal,
        previousWeek,
        analyzedSessions,
        longitudinalWeeks,
      ),
    };
  }

  private buildPlannerGuardrails(
    input: AiPlannerInput,
    deterministicContext: DeterministicPlannerContext,
    longitudinalWeeks?: LongitudinalWeek[],
    minTrainingDate?: string,
  ): PlannerGuardrails {
    return {
      weekDates: input.weekDates,
      availableDays: input.availableDays,
      weeklyVolumeMaxKm: deterministicContext.weeklyVolumeMaxKm,
      goalAttemptAllowed: deterministicContext.goalAttempt?.feasible,
      analysisOverride: this.buildAnalysisOverride(input, longitudinalWeeks),
      defaultPaceSecPerKm: parsePace(input.avgPace) ?? 390,
      minTrainingDate,
    };
  }

  private buildAnalysisOverride(
    input: AiPlannerInput,
    longitudinalWeeks?: LongitudinalWeek[],
  ): Omit<RunAnalysis, 'title' | 'fitnessInsights'> {
    const dates = input.runSummaries
      .map((r) => r.date)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    const period = dates.length > 0 ? `${dates[0]} — ${dates[dates.length - 1]}` : 'Sem dados';

    return {
      runsAnalyzed: input.runSummaries.length,
      period,
      avgDistanceKm: round2(input.avgDistKm),
      avgPace: input.avgPace === 'N/A' ? 'N/A' : `${input.avgPace} /km`,
      avgHeartRate: input.avgHR,
      totalDistanceKm: round2(input.totalDistKm),
      trend: this.deriveTrend(longitudinalWeeks),
    };
  }

  private deriveTrend(longitudinalWeeks?: LongitudinalWeek[]): RunAnalysis['trend'] {
    if (!longitudinalWeeks || longitudinalWeeks.length < 2) return 'maintaining';
    const first = longitudinalWeeks[0];
    const last = longitudinalWeeks[longitudinalWeeks.length - 1];
    const firstPace = parsePace(first.avgPace);
    const lastPace = parsePace(last.avgPace);
    const paceImproved = firstPace != null && lastPace != null && firstPace - lastPace > 5;

    if (last.totalKm < first.totalKm * 0.85) return 'declining';
    if (last.totalKm > first.totalKm * 1.1) return 'improving (volume)';
    if (paceImproved) return 'improving (intensity)';
    return 'maintaining';
  }

  private assessUndatedGoalAttempt(
    goal: ParsedGoal | null,
    previousWeek: PreviousWeekAnalysis | null | undefined,
    analyzedSessions: Awaited<ReturnType<WorkoutExecutionAnalyzerService['analyzeSessions']>>,
    longitudinalWeeks?: LongitudinalWeek[],
  ): GoalAttemptContext | undefined {
    if (!goal || goal.eventDate || !goal.targetDistance || !goal.targetTime) return undefined;
    const targetDistanceMeters = parseTargetDistanceMeters(goal.targetDistance);
    const targetTimeSec = parseTargetTimeSeconds(goal.targetTime);
    if (!targetDistanceMeters || !targetTimeSec) return undefined;

    const targetPaceSec = targetTimeSec / (targetDistanceMeters / 1000);
    const targetPace = `${this.formatPaceFromSecondsPerKm(targetPaceSec)}/km`;
    const recentSpecificPaceSec = this.bestSimilarContinuousPace(
      analyzedSessions,
      targetDistanceMeters,
    );
    const adherence = previousWeek?.completionRate ?? 1;
    const adherencePct = Math.round(adherence * 100);
    const fatigue = previousWeek?.avgFatigue ?? null;
    const hasOverreach =
      (fatigue !== null && fatigue > 7) || this.hasSustainedOverreach(longitudinalWeeks);

    const paceReady =
      recentSpecificPaceSec !== null && recentSpecificPaceSec <= targetPaceSec * 1.03;
    const feasible = paceReady && adherence >= 0.7 && !hasOverreach;
    const recentPace =
      recentSpecificPaceSec !== null
        ? `${this.formatPaceFromSecondsPerKm(recentSpecificPaceSec)}/km`
        : undefined;

    let reason: string;
    if (feasible) {
      reason = `Viável: pace recente específico ${recentPace} está dentro de 3% do alvo ${targetPace}, aderência ${adherencePct}% e sem sinal de overreach.`;
    } else if (recentSpecificPaceSec === null) {
      reason = `Ainda não é viável: não há esforço contínuo recente de distância similar para validar o alvo ${targetPace}; tiros curtos não bastam para provar sustentação em ${goal.targetDistance}.`;
    } else if (!paceReady) {
      reason = `Ainda não é viável: pace recente específico ${recentPace} está fora da margem de 3% do alvo ${targetPace}; aderência ${adherencePct}%.`;
    } else if (adherence < 0.7) {
      reason = `Ainda não é viável: aderência recente ${adherencePct}% está abaixo do mínimo de 70%, apesar do pace estar próximo do alvo ${targetPace}.`;
    } else {
      reason = `Ainda não é viável: há sinal de overreach/fadiga recente, então a semana deve priorizar absorção antes de tentar ${goal.targetDistance}.`;
    }

    return {
      feasible,
      targetPace,
      recentPace,
      adherencePct,
      reason,
    };
  }

  private bestSimilarContinuousPace(
    analyzedSessions: Awaited<ReturnType<WorkoutExecutionAnalyzerService['analyzeSessions']>>,
    targetDistanceMeters: number,
  ): number | null {
    const minSimilarKm = (targetDistanceMeters / 1000) * 0.7;
    let best: number | null = null;

    for (const analyzed of analyzedSessions) {
      if (analyzed.session.segments.some((s) => s.label === SegmentLabel.rep)) continue;
      const mainDistanceKm = this.mainContinuousDistanceKm(analyzed.session);
      if (mainDistanceKm < minSimilarKm) continue;
      const pace = parsePace(analyzed.executionAnalysis.mainPace);
      if (pace === null) continue;
      if (best === null || pace < best) best = pace;
    }

    return best;
  }

  private mainContinuousDistanceKm(session: DetailedSessionDto): number {
    const segs = session.segments ?? [];
    if (segs.length === 0) return session.distanceMeters / 1000;
    const hasBoundaryLabels = segs.some(
      (s) => s.label === SegmentLabel.warmup || s.label === SegmentLabel.cooldown,
    );
    const main = hasBoundaryLabels
      ? segs.filter((s) => s.label !== SegmentLabel.warmup && s.label !== SegmentLabel.cooldown)
      : segs;
    return main.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0);
  }

  private hasSustainedOverreach(longitudinalWeeks?: LongitudinalWeek[]): boolean {
    if (!longitudinalWeeks || longitudinalWeeks.length < 4) return false;
    const last4 = longitudinalWeeks.slice(-4);
    const volumeUpEveryWeek = last4
      .slice(1)
      .every((week, idx) => week.totalKm > last4[idx].totalKm * 1.1);
    if (!volumeUpEveryWeek) return false;
    const firstPace = parsePace(last4[0].avgPace);
    const lastPace = parsePace(last4[last4.length - 1].avgPace);
    const paceImproved = firstPace != null && lastPace != null && firstPace - lastPace > 5;
    return !paceImproved;
  }

  /**
   * Candidatos de esforço LIMPO para o cálculo de VDOT a partir de sessões detalhadas.
   * O pace médio de corrida inteira subestima o atleta — e uma janela contínua que inclua
   * as recuperações entre tiros também (era o bug: tiros sub-5'00 saíam diluídos pelos
   * trotes e o VDOT vinha baixo). Em vez disso, por sessão extraímos:
   *   (1) candidato de qualidade: os tiros (`rep`) concatenados, SEM as recuperações;
   *   (2) candidato sustentado: a melhor janela contínua (>= MIN_EFFORT_METERS) de blocos
   *       de esforço estável (`tempo`/`easy`), excluindo tiros e recuperações.
   * findBestEffort escolhe depois o de VDOT mais alto entre todos os candidatos. Sessões
   * `synthetic` (Garmin/Nike só com totais via Apple Health) não têm splits reais e são
   * ignoradas — caem no piso dos totais de input.runs.
   */
  private bestSubEffortsFromSessions(sessions: DetailedSessionDto[]): RunDataForZones[] {
    const candidates: RunDataForZones[] = [];
    for (const session of sessions) {
      if (session.splitsSource === 'synthetic') continue;
      const segs = session.segments ?? [];

      // (1) Qualidade: soma só dos tiros (rep), recuperações fora. Captura a velocidade
      // real dos tiros sem a diluição dos trotes.
      const reps = segs.filter(
        (s) => s.label === SegmentLabel.rep && s.distanceKm > 0 && s.durationSeconds > 0,
      );
      const repDistM = reps.reduce((sum, s) => sum + s.distanceKm * 1000, 0);
      const repDurSec = reps.reduce((sum, s) => sum + s.durationSeconds, 0);
      if (repDistM >= MIN_EFFORT_METERS && repDurSec > 0) {
        candidates.push({
          distanceMeters: repDistM,
          durationSeconds: repDurSec * REP_EFFORT_PENALTY,
          averageHeartRate: null,
          maxHeartRate: null,
        });
      }

      // (2) Sustentado: melhor janela contínua de tempo/easy (sem rep/rec). Cobre tempo
      // runs e o trecho mais rápido de corridas steady/progressivas.
      const steady = segs.filter(
        (s) =>
          (s.label === SegmentLabel.tempo || s.label === SegmentLabel.easy) &&
          s.distanceKm > 0 &&
          s.durationSeconds > 0,
      );
      const best = this.bestContinuousWindow(steady);
      if (best) {
        candidates.push({
          distanceMeters: best.distM,
          durationSeconds: best.durSec,
          averageHeartRate: null,
          maxHeartRate: null,
        });
      }
    }
    return candidates;
  }

  /**
   * Melhor (mais rápida) janela contígua de >= MIN_EFFORT_METERS a partir de uma lista de
   * splits de esforço estável já filtrada. Janela mínima a partir de cada início: janelas
   * maiores só diluiriam o pace.
   */
  private bestContinuousWindow(
    segs: Array<{ distanceKm: number; durationSeconds: number }>,
  ): { distM: number; durSec: number } | null {
    let best: { distM: number; durSec: number } | null = null;
    for (let i = 0; i < segs.length; i++) {
      let distM = 0;
      let durSec = 0;
      for (let j = i; j < segs.length; j++) {
        distM += segs[j].distanceKm * 1000;
        durSec += segs[j].durationSeconds;
        if (distM >= MIN_EFFORT_METERS) {
          const pace = durSec / (distM / 1000);
          const bestPace = best ? best.durSec / (best.distM / 1000) : Infinity;
          if (pace < bestPace) best = { distM, durSec };
          break;
        }
      }
    }
    return best;
  }

  private async buildLongitudinalTrend(
    trainingPlanId: string,
    currentWeekStart: Date,
    detailedSessions: DetailedSessionDto[] = [],
  ): Promise<LongitudinalWeek[] | undefined> {
    const recent = await this.prisma.weeklyGoal.findMany({
      where: {
        trainingPlanId,
        weekEndDate: { lt: currentWeekStart },
      },
      orderBy: { weekStartDate: 'desc' },
      take: LONGITUDINAL_WEEKS,
      include: {
        workouts: { include: { feedback: true } },
      },
    });

    if (recent.length === 0) return undefined;
    return computeLongitudinalWeeks(recent, { detailedSessions });
  }

  private buildAiInputFromHealthRuns(
    runs: PlanFromHealthDto['runs'],
    weekDates: string[],
    trainingDays: number,
    availableDays: string[],
    minTrainingDate?: string,
  ): AiPlannerInput {
    // Descarta outliers (<0.5km OU <3min) das stats agregadas — fallback para runs original se zerar.
    const validRunsRaw = runs.filter((r) => r.distanceMeters >= 500 && r.durationSeconds >= 180);
    const validRuns = validRunsRaw.length > 0 ? validRunsRaw : runs;

    const totalDistM = validRuns.reduce((sum, r) => sum + r.distanceMeters, 0);
    const totalDistKm = totalDistM / 1000;
    const avgDistKm = validRuns.length > 0 ? totalDistKm / validRuns.length : 0;
    const maxDistKm =
      validRuns.length > 0 ? Math.max(...validRuns.map((r) => r.distanceMeters / 1000)) : 0;

    const runSummaries: RunSummary[] = validRuns.map((r, i) => {
      const distanceKm = parseFloat((r.distanceMeters / 1000).toFixed(2));
      const durationMin = Math.round(r.durationSeconds / 60);
      const paceStr =
        r.averagePaceSecondsPerKm != null && r.averagePaceSecondsPerKm > 0
          ? this.formatPaceFromSecondsPerKm(r.averagePaceSecondsPerKm)
          : 'N/A';
      return {
        index: i + 1,
        name: `Corrida ${i + 1}`,
        date: r.startDate.split('T')[0],
        distanceKm,
        durationMin,
        avgPace: paceStr,
        avgHR: null,
        elevationGain: r.elevationGainMeters ?? null,
      };
    });

    const paceSum = validRuns.filter(
      (r) => r.averagePaceSecondsPerKm != null && r.averagePaceSecondsPerKm > 0,
    );
    const avgPaceSecondsPerKm =
      paceSum.length > 0
        ? paceSum.reduce((s, r) => s + (r.averagePaceSecondsPerKm ?? 0), 0) / paceSum.length
        : 0;
    const avgPace =
      avgPaceSecondsPerKm > 0 ? this.formatPaceFromSecondsPerKm(avgPaceSecondsPerKm) : 'N/A';

    return {
      runSummaries,
      avgDistKm,
      avgPace,
      avgHR: null,
      maxDistKm,
      totalDistKm,
      weekDates,
      trainingDays,
      availableDays,
      minTrainingDate,
    };
  }

  private formatPaceFromSecondsPerKm(paceSecondsPerKm: number): string {
    if (!paceSecondsPerKm || paceSecondsPerKm <= 0) return 'N/A';
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.round(paceSecondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private async resolveTrainingPlan(
    userId: string,
    weekStartDate: string,
    activeGoalId?: string,
    goalSummary?: string,
    eventDate?: string | null,
  ) {
    const existing = await this.prisma.trainingPlan.findUnique({ where: { userId } });
    const targetDate = eventDate ? new Date(eventDate) : null;

    if (existing) {
      if (
        existing.status === TrainingPlanStatus.CANCELLED ||
        existing.status === TrainingPlanStatus.COMPLETED
      ) {
        throw new ConflictException(
          `Training plan is ${existing.status.toLowerCase()}. Delete it and create a new one before generating a plan.`,
        );
      }
      if (existing.status === TrainingPlanStatus.LOCKED) {
        throw new ConflictException('Training plan is locked and cannot be modified.');
      }
      const needsGoalUpdate = !!activeGoalId && existing.userGoalId !== activeGoalId;
      const existingTargetISO = existing.targetDate
        ? existing.targetDate.toISOString().split('T')[0]
        : null;
      const needsTargetUpdate = !!eventDate && existingTargetISO !== eventDate;
      if (needsGoalUpdate || needsTargetUpdate) {
        const data: Prisma.TrainingPlanUpdateInput = {};
        if (needsGoalUpdate) {
          data.userGoal = { connect: { id: activeGoalId } };
          data.objective = goalSummary ?? existing.objective;
        }
        if (needsTargetUpdate) data.targetDate = targetDate;
        const updated = await this.prisma.trainingPlan.update({ where: { id: existing.id }, data });
        return updated;
      }
      return existing;
    }

    return this.prisma.trainingPlan.create({
      data: {
        userId,
        startDate: weekStartDate,
        objective: goalSummary ?? 'Plano de corrida gerado por IA',
        status: TrainingPlanStatus.ACTIVE,
        sports: [SportType.running],
        autoGenerate: true,
        userGoalId: activeGoalId ?? null,
        targetDate,
      },
    });
  }

  private async checkWeekOverlap(trainingPlanId: string, weekStartDate: Date, weekEndDate: Date) {
    const existing = await this.prisma.weeklyGoal.findFirst({
      where: {
        trainingPlanId,
        weekStartDate: { lte: weekEndDate },
        weekEndDate: { gte: weekStartDate },
      },
      include: { _count: { select: { workouts: true } } },
    });

    if (!existing) return;

    const hasWorkouts = existing._count.workouts > 0;

    // LOCKED, ou GENERATED já com workouts → semana real do usuário: recusa sobrescrever.
    if (
      existing.status === WeeklyGoalStatus.LOCKED ||
      (existing.status === WeeklyGoalStatus.GENERATED && hasWorkouts)
    ) {
      throw new ConflictException(
        'A plan for this week already exists. Delete the existing weekly goal and its workouts before regenerating.',
      );
    }

    // PLANNED é apenas esqueleto/reserva e ainda não pode ser exibido como pronto.
    await this.prisma.workout.deleteMany({ where: { weeklyGoalId: existing.id } });
    await this.prisma.weeklyGoal.delete({ where: { id: existing.id } });
  }

  /**
   * Cria o placeholder da semana ANTES da geração (reserva atômica). A unique constraint
   * (trainingPlanId, weekStartDate) garante que apenas uma geração concorrente vença; as
   * demais recebem ConflictException em vez de criar uma semana duplicada/sobreposta.
   */
  private async reserveWeeklyGoal(trainingPlanId: string, weekStartDate: Date, weekEndDate: Date) {
    try {
      return await this.prisma.weeklyGoal.create({
        data: {
          trainingPlanId,
          weekStartDate,
          weekEndDate,
          status: WeeklyGoalStatus.PLANNED,
          metrics: {} as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          'Uma geração para esta semana já está em andamento ou já existe.',
        );
      }
      throw err;
    }
  }

  /** Libera (deleta) um placeholder reservado quando a geração/persistência falha. */
  private async releaseReservation(weeklyGoalId: string) {
    await this.prisma.weeklyGoal.delete({ where: { id: weeklyGoalId } }).catch(() => undefined);
  }

  /**
   * Resolves the current week's PlannedWeek (phase + volume targets) for a dated goal
   * and lazily lays out / extends the future PLANNED skeleton up to the event date.
   * Returns null for goals without a parseable dated target.
   */
  private async resolveCurrentPlannedWeek(params: {
    trainingPlanId: string;
    startDateISO: string;
    weekStartISO: string;
    weekEndDate: Date;
    goal: ParsedGoal | null;
    currentWeeklyVolumeKm: number;
    preReadMetrics: unknown;
  }): Promise<PlannedWeek | null> {
    const { goal } = params;
    if (!goal?.eventDate) return null;
    const targetDistanceMeters = parseTargetDistanceMeters(goal.targetDistance);
    if (targetDistanceMeters == null) return null;

    // A PLANNED row laid out by a previous skeleton build carries the stable phase/targets.
    const fromMetrics = this.plannedWeekFromMetrics(params.preReadMetrics);

    const macro = buildMacrocycle({
      startMondayISO: params.startDateISO,
      eventDate: goal.eventDate,
      targetDistanceMeters,
      currentWeeklyVolumeKm: params.currentWeeklyVolumeKm,
      experienceLevel: goal.experienceLevel ?? null,
    });
    if (macro.length === 0) return fromMetrics;

    await this.persistFutureSkeleton(params.trainingPlanId, macro, params.weekEndDate);

    // Prefer the persisted (stable) context; fall back to the in-memory current week.
    return fromMetrics ?? macro.find((w) => w.weekStartDate === params.weekStartISO) ?? null;
  }

  private plannedWeekFromMetrics(metrics: unknown): PlannedWeek | null {
    const m = metrics as Partial<PlannedWeek> | null;
    if (!m || typeof m !== 'object' || !m.phase) return null;
    return m as PlannedWeek;
  }

  /**
   * Creates PLANNED WeeklyGoal placeholders for every macrocycle week AFTER the current
   * one that does not already have a weekly goal. Idempotent: skips weeks already present,
   * so the skeleton is laid out once and survives subsequent generations.
   */
  private async persistFutureSkeleton(
    trainingPlanId: string,
    macro: PlannedWeek[],
    currentWeekEnd: Date,
  ): Promise<void> {
    const futureWeeks = macro.filter((w) => new Date(w.weekStartDate) > currentWeekEnd);
    for (const w of futureWeeks) {
      const start = new Date(w.weekStartDate);
      const end = new Date(w.weekEndDate);
      const exists = await this.prisma.weeklyGoal.findFirst({
        where: { trainingPlanId, weekStartDate: { lte: end }, weekEndDate: { gte: start } },
        select: { id: true },
      });
      if (exists) continue;
      try {
        await this.prisma.weeklyGoal.create({
          data: {
            trainingPlanId,
            weekStartDate: start,
            weekEndDate: end,
            status: WeeklyGoalStatus.PLANNED,
            metrics: w as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        // Corrida na montagem do esqueleto: outra geração já criou esta semana. Idempotente.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
      }
    }
  }

  /** Recomputes and stores the active goal's feasibility snapshot using the freshest VDOT. */
  private async refreshGoalFeasibility(
    goalId: string | undefined,
    goal: ParsedGoal | null,
    vdotScore: number | null,
    asOfISO: string,
  ): Promise<void> {
    if (!goalId || !goal?.eventDate || vdotScore == null) return;
    const feasibility = assessGoalFeasibility({
      goal: {
        targetDistance: goal.targetDistance,
        targetTime: goal.targetTime,
        eventDate: goal.eventDate,
        experienceLevel: goal.experienceLevel ?? null,
      },
      currentVdot: vdotScore,
      asOfISO,
      lowConfidence: false,
    });
    if (!feasibility) return;
    await this.prisma.userGoal.update({
      where: { id: goalId },
      data: { feasibility: feasibility as unknown as Prisma.InputJsonValue },
    });
  }

  private resolvePlanningWindow(
    inputWeekStartDate: string | undefined,
    baseAvailableDays: string[],
    now = new Date(),
  ): PlanningWindow {
    const normalizedAvailableDays = this.normalizeAvailableDays(baseAvailableDays);

    if (inputWeekStartDate) {
      return this.buildPlanningWindow(new Date(inputWeekStartDate), normalizedAvailableDays);
    }

    const todayISO = this.toISODate(now);
    const currentMonday = this.getCurrentMonday(now);
    const currentWeekDates = this.getWeekDates(currentMonday);
    const availableSet = new Set(normalizedAvailableDays);
    const remainingAvailableDays = currentWeekDates
      .filter((date) => date >= todayISO)
      .map((date) => this.isoDayKey(date))
      .filter((day) => availableSet.has(day));

    if (remainingAvailableDays.length > 0) {
      return this.buildPlanningWindow(currentMonday, remainingAvailableDays, todayISO);
    }

    return this.buildPlanningWindow(this.addDays(currentMonday, 7), normalizedAvailableDays);
  }

  private buildPlanningWindow(
    monday: Date,
    availableDays: string[],
    minTrainingDate?: string,
  ): PlanningWindow {
    const weekDates = this.getWeekDates(monday);
    return {
      weekDates,
      weekStartDate: new Date(weekDates[0]),
      weekEndDate: new Date(weekDates[6]),
      availableDays,
      trainingDays: availableDays.length,
      minTrainingDate,
    };
  }

  private normalizeAvailableDays(days: string[]): string[] {
    const validDays = new Set([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]);
    const seen = new Set<string>();
    const normalized = days
      .map((day) => day.toLowerCase())
      .filter((day) => {
        if (!validDays.has(day) || seen.has(day)) return false;
        seen.add(day);
        return true;
      });

    return normalized.length > 0 ? normalized : DEFAULT_AVAILABLE_DAYS;
  }

  private getCurrentMonday(now: Date): Date {
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const monday = new Date(now);
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(date.getDate() + days);
    return next;
  }

  private toISODate(date: Date): string {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    return startOfDay.toISOString().split('T')[0];
  }

  private isoDayKey(date: string): string {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][day];
  }

  private getWeekDates(monday: Date): string[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }

  /**
   * Derives the legacy `blocks` array. When the segments tree is empty
   * (validation wiped it, or the AI omitted it entirely) we synthesize a
   * placeholder so the workout is still visible on legacy iOS clients and
   * the user can see something instead of an empty card.
   */
  private deriveBlocksForPersistence(day: {
    segments?: unknown;
    description?: string;
    sportType: SportType;
  }) {
    const segments = (day.segments ?? []) as Parameters<typeof flattenToLegacyBlocks>[0];
    const derived = flattenToLegacyBlocks(segments);
    if (derived.length > 0) return derived;

    if (day.sportType === SportType.other) {
      return [{ type: 'rest', instructions: 'Dia de descanso completo.' }];
    }
    return [
      {
        type: 'main',
        instructions:
          day.description ?? 'Treino com formato inválido. Por favor, regenere a semana.',
      },
    ];
  }
}

function parsePace(pace: string | null | undefined): number | null {
  if (!pace || pace === 'N/A') return null;
  const match = pace.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
