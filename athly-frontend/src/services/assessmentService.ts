import { api } from './api'
import type { SubmitAssessmentDto } from '../client'

export type AssessmentAnswers = SubmitAssessmentDto

export async function submitAssessment(answers: AssessmentAnswers) {
  return api.assessment.assessmentControllerSubmit({
    submitAssessmentDto: answers,
  })
}

export async function getAssessment(): Promise<AssessmentAnswers | null> {
  try {
    const result = await api.assessment.assessmentControllerFindMine()
    return result as AssessmentAnswers
  } catch {
    return null
  }
}
