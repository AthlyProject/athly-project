import { api } from './api'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export interface AssessmentAnswers {
  goals: {
    practicesRegularly?: string
    targetDistance?: string
    motivations?: string[]
  }
  activityHistory: {
    currentActivities?: string[]
    trainingPreparedBy?: string
    canRun3km?: string
    runningExperience?: string
  }
  trainingPlanning: {
    availableDays?: string[]
    startDate?: string
    hasTargetDate?: string
    targetDate?: string
  }
  performanceHealth: {
    referenceDistance?: string
    bestTime?: string
    sleepQuality?: number
    hasChronicPain?: string
    chronicPainDescription?: string
  }
  parq: {
    heartCondition?: boolean
    chestPainDuringActivity?: boolean
    chestPainLastMonth?: boolean
    dizzinessOrLossOfConsciousness?: boolean
    boneJointProblem?: boolean
    takingBloodPressureMeds?: boolean
    otherReasonToAvoidExercise?: boolean
  }
  gender?: string
  termsAccepted: boolean
}

async function authFetch(path: string, options?: RequestInit) {
  const token = api.getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.message ?? 'Erro ao comunicar com o servidor')
  }
  return res.json()
}

export async function submitAssessment(answers: AssessmentAnswers) {
  return authFetch('/assessment', {
    method: 'POST',
    body: JSON.stringify(answers),
  })
}

export async function getAssessment(): Promise<AssessmentAnswers | null> {
  try {
    return await authFetch('/assessment')
  } catch {
    return null
  }
}
