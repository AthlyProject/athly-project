---
tags: [camada/ios, tipo/documento]
camada: ios
tipo: documento
status: implementado
created: 2026-04-24
---

# Stack iOS

## Versões

| Tech | Versão/Requisito |
|------|------------------|
| Swift | 5.9+ |
| SwiftUI | iOS 16.0+ |
| Combine | nativo |
| HealthKit | nativo |
| CoreLocation | nativo |
| ActivityKit | iOS 16.1+ |
| OSLog | nativo |
| SPM | nativo |
| External deps | **ZERO** |

## Arquitetura: MVVM + Combine

```
Models/
  ├── RunSession, RoutePoint, Split
  ├── HealthKitRunItem
  ├── APIModels (SportType, etc.)
  └── RunWorkoutLink

ViewModels/ (@MainActor)
  ├── AuthViewModel
  ├── RunViewModel
  ├── TrainingPlanViewModel
  └── HealthKitRunsViewModel

Views/
  ├── Auth (LoginView, RegisterView)
  ├── Run (tracking, map, summary)
  ├── Plan (calendar, workouts)
  └── Dashboard, History, Profile, HealthKit

Services/
  ├── APIClient (URLSession + refresh)
  ├── LocationManager (GPS)
  ├── HealthKitService
  ├── RunTracker (distance, pace, splits)
  ├── LiveActivityManager
  └── 10+ support services
```

## Key patterns

- `@MainActor` on ViewModels
- `@Published` for observable properties
- `@StateObject` for lifecycle management
- Combine operators (`.receive(on:)`, `.sink`, etc.)
- Async/await (where applicable)

---

Ver: [[_MOC iOS]], [[ADR-I01 SwiftUI + MVVM]]
