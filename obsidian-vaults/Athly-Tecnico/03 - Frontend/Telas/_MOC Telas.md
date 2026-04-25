---
tags: [camada/frontend, tipo/moc]
camada: frontend
tipo: moc
status: implementado
created: 2026-04-24
---

# Telas Frontend — MOC

14 rotas: público (3) + auth (2) + app (9).

## Público

- [[LandingPage|/]] — homepage
- [[LoginPage|/login]] — login
- [[RegisterPage|/register]] — register

## Auth Flow

- [[AssessmentPage|/assessment]] — avaliação inicial (5 sessões)
- [[OAuthCallbackPage|/oauth/strava/callback]] — Strava redirect

## App (protegidas, require assessment completo)

- [[DashboardPage|/app/dashboard]] — visão geral
- [[PlanPage|/app/plan]] — próximo plano semanal
- [[TrainingPlanCalendarPage|/app/training-plan]] — calendário planos
- [[WorkoutPage|/app/workout/:id]] — detalhe workout
- [[FeedbackPage|/app/feedback/:id]] — feedback pós-workout
- [[HistoryPage|/app/history]] — histórico workouts
- [[ProfilePage|/app/profile]] — perfil
- [[SettingsPage|/app/settings]] — configurações
- [[DesignSystemPage|/app/design-system]] — design system showcase

---

Ver: [[_MOC Frontend]], [[Rotas e Guards]]
