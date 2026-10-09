# iOS navigation performance

The October 2026 changes keep tab navigation state, move persistence and imported-workout computation off the UI executor, and reuse prepared calendar/history/profile data. Automatic tab loads have a 60-second freshness window; explicit refreshes and plan-generation/mutation events invalidate it.

## Measurements

The original Plan rendering path scanned the entire workout list approximately 28 times per displayed week. Recreating date formatters, including two unsuccessful ISO attempts before parsing the backend's `yyyy-MM-dd`, took 177 / 533 / 1,051 ms with 28 / 84 / 168 synthetic workouts in a standalone Mac reproduction (median of three runs).

The new `NavigationPerformanceTests.testCalendarLookupsWith365Workouts` exercises 28 indexed day lookups against 365 workouts. Warm samples in the iOS simulator were approximately 0.06 ms. This excludes index construction, layout, drawing, network, and disk. It is not an end-to-end navigation measurement or a direct hardware-to-hardware comparison with the original benchmark.

## Automated verification

Run the `AthlyRunner` scheme's tests on an available iOS simulator. The suite covers date-only and ISO dates, time zones, rescheduling and completion races, duplicate imports, asynchronous hydration, immutable snapshots, write failure, queued writes followed by clear, shared plan loads, explicit refresh, and progressive HealthKit presentation.

Build for a generic iOS device too: some real HealthKit code is excluded from simulator builds.

Persistence retains the existing JSON formats. `RunStore.loadIfNeeded()` hydrates asynchronously; `flush()` is the durable boundary for confirming a saved run. An unreadable history is retained and reported, never replaced by an empty history. Cache `load()` methods read memory only; startup uses `loadFromDisk()`.

## Physical-device verification

Use a Release/Profile build on an iPhone, with and without a debugger:

1. Open Home, Plan, History, Profile, and Run repeatedly with 28, 84, 168, and 365 planned workouts. Verify immediate input response and retained week, scroll position, and navigation detail.
2. Repeat with an empty cache, a warm cache, slow networking, and offline. Existing data must remain visible during refresh, and another tab must remain selectable.
3. Verify that leaving Run's pre-run screen stops GPS; active recording must keep GPS and its current session. Completing or discarding a run must preserve the existing tab-bar behavior.
4. Complete, reschedule, unlink, and reimport the same workout while a refresh is pending. Verify consistent server-confirmed status on Home, Plan, and History, preserved local activities, and updated reminders.
5. Open a large history and long GPS routes. Change unrelated UI state in a run detail: the map must not recreate the route. Profile records must update when an existing run changes, including changes that do not increase the number of runs.
6. Change the day/time zone, revoke Health access, log out during refresh, and retry after a local persistence failure. No obsolete response or queued cache write may restore the previous session's plan cache.

Record Time Profiler, Hangs, and SwiftUI updates in Instruments. The `com.athly.runner` / `Performance` category includes `TabSelected`, `PlanLoad`, `CacheRead`, `CacheWrite`, and `SessionRestore`. Use the rendering timeline to identify the first presented frame after `TabSelected`; `PlanLoad` also includes network wait and is not a frame-time metric. Target less than 100 ms for a warm tab response. Trace startup profile/network wait separately without changing authentication behavior.

A physical-device navigation trace was not captured during implementation because the connected-device list reported the iPhone offline.
