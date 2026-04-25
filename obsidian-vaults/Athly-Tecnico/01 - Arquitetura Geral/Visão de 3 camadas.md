---
tags: [camada/cross, tipo/documento]
camada: cross
tipo: documento
status: implementado
created: 2026-04-24
---

# Visão de 3 camadas

## Camadas

### 1. Frontend (React)
- **Responsabilidade**: Interface de usuário web, autenticação local, chamadas REST para backend
- **Stack**: React 19, TypeScript, TailwindCSS, Zustand, React Hook Form, Vite
- **Rotas**: 14 telas públicas + autenticadas
- **Auth**: JWT (localStorage), refresh automático
- **Design System**: "raposa neon" (dark, gradientes azul→roxo)

Ver: [[_MOC Frontend]]

### 2. Backend (NestJS)
- **Responsabilidade**: Orquestração, persistência, IA, integrações (Strava, Google Generative AI)
- **Stack**: NestJS 11, TypeScript, Prisma 7, PostgreSQL 14+, JWT + Passport, Gemini 2.5-flash
- **Modelos**: 14 tabelas (User, TrainingPlan, WeeklyGoal, Workout, Integration, Assessment, etc.)
- **Módulos**: 13 (auth, users, workouts, training-plans, weekly-goals, equipments, ai-planner, etc.)
- **Endpoints**: ~40 REST endpoints

Ver: [[_MOC Backend]]

### 3. iOS (SwiftUI)
- **Responsabilidade**: Experiência mobile nativa, GPS + HealthKit, live activities durante corrida
- **Stack**: Swift, SwiftUI, Combine, HealthKit, ActivityKit, OSLog, zero deps externas (SPM)
- **Arquitetura**: MVVM + @MainActor + Combine
- **Services**: APIClient (URLSession), LocationManager, HealthKitService, RunTracker
- **Auth**: Keychain + tokens em memória, refresh automático

Ver: [[_MOC iOS]]

## Interfaces (cross-layer)

| Camada A | Interface | Camada B | Protocolo |
|----------|-----------|----------|-----------|
| Frontend | REST API | Backend | JSON + JWT |
| iOS | REST API | Backend | JSON + JWT |
| Frontend | OAuth | Strava | OAuth 2.0 |
| iOS | HealthKit read | HealthKit | nativo |
| Backend | Gemini API | Google | gRPC + JSON |

## Data Flow

```
User (Frontend/iOS)
  ↓ REST + JWT
Backend (NestJS)
  ├→ Prisma + PostgreSQL (persistência)
  ├→ Strava API (integração runs)
  ├→ Gemini 2.5-flash (AI planning)
  └→ Email/Notifications (async)

iOS (nativo)
  ├→ HealthKit (runs, energy)
  ├→ LocationManager (GPS)
  └→ Live Activity (durante corrida)
```

## Segurança

- **JWT**: access token 1h, refresh em Session table
- **HTTPS**: em produção (api.athlyproject.app)
- **Auth Guard**: JwtAuthGuard + @CurrentUser no backend
- **Keychain**: iOS armazena tokens
- **LocalStorage**: Frontend armazena JWT (com persistência controlada)

Ver: [[Auth Flow (backend + frontend + iOS)]]

---

**Tags**: `camada/cross`, `tipo/arquitetura`
