# Planner heart-rate compatibility

The planner sends optional `avgHR` and `maxHR` values in `runs[]`. Older backend
contracts reject them once per field and run: 20 runs can produce 40 errors. The
backend must accept these fields before distributing the updated iOS app. The
client does not retry requests with heart-rate data removed.

`BackendErrorBody` summarizes unknown-property errors as one localized message.
Other validation errors retain their translations, remove duplicates and display
up to three distinct lines. `APIError.serverError` retains its HTTP status for
callers without including that status in its display text.

`MainTabView` owns the shared plan alert. Dismissal clears `planVM.errorMessage`.
Completion methods instead return `WorkoutCompletionOutcome` to the sheet or
detection flow that presents the error; they do not publish a second global alert.
Automatic health synchronization continues without presenting a modal on failure.

## Diagnostics

The existing OTel exporter emits `api.validation_failed` for HTTP 400 validation
responses. Attributes include the method, normalized route, error count and
distinct field/constraint/code identifiers. Session and build information comes
from the existing OTel resource. Request bodies, response messages, authentication
headers and health values are excluded. Extend the explicit route templates when
adding endpoints; unmatched paths are reported as `/unknown`.

## Verification

- Backend: run the planner DTO contract tests using the application's strict
  `ValidationPipe`, followed by the backend suite and build. No database migration
  is required for this contract change.
- iOS: run the `AthlyRunner` scheme tests. `BackendErrorCodeTests` covers the
  40-error reproduction, legacy responses, summary limits and sanitized diagnostics
  for required and optional HTTP responses. `WorkoutCompletionTests` checks that
  a failed completion remains pending and does not publish or replace global errors.
- After confirming the backend deployment, open the app on an iPhone with Health
  workouts containing heart-rate measurements, switch Dashboard/Plan, then background
  and reopen the app. Health sync should succeed without unknown-property errors.
- With a stubbed validation failure, verify one short alert, dismiss it and switch
  tabs: it must not return. A new explicit failed action may show a new alert.
- In a test account, fail a workout completion and confirm the error stays in its
  sheet, the sheet remains open and the workout is not marked done. Retry successfully.
