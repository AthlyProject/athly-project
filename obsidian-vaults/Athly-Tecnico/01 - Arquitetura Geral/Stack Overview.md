---
tags: [camada/cross, tipo/documento]
camada: cross
tipo: documento
status: implementado
created: 2026-04-24
---

# Stack Overview

## Backend

| Categoria | Tech | Versão |
|-----------|------|--------|
| Runtime | Node.js | 20+ |
| Framework | NestJS | 11.0.1 |
| Language | TypeScript | 5.7.3 |
| ORM | Prisma | 7.3.0 |
| Database | PostgreSQL | 14+ |
| Auth | Passport + JWT | 11+ |
| Validation | class-validator | 0.14+ |
| Hashing | bcrypt | 5.1+ |
| AI | @google/generative-ai | 0.24.1 (Gemini 2.5-flash) |
| Docs | @nestjs/swagger | 7+ |

**Modelos Prisma**: 14 tabelas, enums (SportType, TrainingPlanStatus, WorkoutStatus, etc.)

Ver: [[Stack Backend]]

## Frontend

| Categoria | Tech | Versão |
|-----------|------|--------|
| Runtime | Node.js | 20+ |
| Framework | React | 19.2.0 |
| Language | TypeScript | 5.9.3 |
| Bundler | Vite | 7.2.4 |
| Router | React Router | 7.13.0 |
| State | Zustand | 5.0.11 |
| Styling | TailwindCSS | 4.1.18 |
| Validation | Zod + React Hook Form | 4.3.6 + 7.71.1 |
| Icons | Lucide React | latest |
| Notifications | React Hot Toast | 2.6.0 |

**Design**: Dark-first, gradientes azul→roxo, glow neon

Ver: [[Stack Frontend]]

## iOS

| Categoria | Tech | Versão |
|-----------|------|--------|
| Language | Swift | 5.9+ |
| UI | SwiftUI | iOS 16.0+ |
| Architecture | MVVM + Combine | nativo |
| Storage | Core Data (optional) | nativo |
| Health | HealthKit | nativo |
| Location | CoreLocation | nativo |
| Live Activity | ActivityKit | iOS 16.1+ |
| Networking | URLSession | nativo |
| Logging | OSLog | nativo |
| Package Manager | SPM | nativo |
| **External deps** | **None** (zero!) | - |

**Observabilidade**: Sentry planejado (5 fases)

Ver: [[Stack iOS]]

---

**Leia também**: [[Divergência IA Claude vs Gemini]] (por que Gemini em vez de Claude)
