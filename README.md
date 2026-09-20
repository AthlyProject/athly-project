# Athly - AI-Powered Workout Planning

Full-stack application for AI-generated workout planning: React frontend and NestJS REST API backend.

## Repository structure

| Package           | Description                    |
|-------------------|--------------------------------|
| [athly-frontend](./athly-frontend) | React + Vite app (mocked, ready for API) |
| [athly-backend](./athly-backend)   | NestJS REST API + Prisma + PostgreSQL    |

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+ (for backend)
- **npm** or **yarn**

## Quick start

### Backend

```bash
cd athly-backend
cp .env.example .env
# Edit .env (DATABASE_URL, JWT_SECRET, etc.)
npm install
npm run db:migrate
npm run dev
```

API: `http://localhost:4000`

### Frontend

```bash
cd athly-frontend
npm install
npm run dev
```

App: `http://localhost:5173` (or the port Vite prints)

### Full stack

1. Start the backend (see above), then start the frontend.
2. To use the real API from the frontend, set in `athly-frontend/.env`:
   - `VITE_API_URL=http://localhost:4000`
   - `VITE_USE_REAL_API=true` (when ready to switch from mocks)

## Tech overview

| Layer     | Stack |
|----------|--------|
| **Frontend** | Vite, React 19, TypeScript, React Router, TailwindCSS 4, Zustand, React Hot Toast |
| **Backend**  | NestJS, Prisma, PostgreSQL, JWT, class-validator |

## Documentation

- **Backend**: [athly-backend/README.md](./athly-backend/README.md) — setup, endpoints, auth, scripts.
- **API reference**: [athly-backend/REST_API_DOCUMENTATION.md](./athly-backend/REST_API_DOCUMENTATION.md) — REST endpoints and types.
- **Frontend**: [athly-frontend/README.md](./athly-frontend/README.md) — structure, routes, mocked login, integration notes.

## Releases

Versioning is automated by [semantic-release](https://semantic-release.gitbook.io/). Every push to
`main` analyzes the commit messages, computes the next version, tags it (`vX.Y.Z`), updates
`CHANGELOG.md`, publishes a GitHub Release, and writes the version into the iOS app.

### Commit format

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(ios): detect today's Apple Health workout on launch
fix(backend): return 404 instead of 500 for unknown plan
```

| Prefix | Bump |
|--------|------|
| `fix:` / `perf:` | patch — `1.2.3` → `1.2.4` |
| `feat:` | minor — `1.2.3` → `1.3.0` |
| `BREAKING CHANGE:` in the body (or `feat!:`) | major — `1.2.3` → `2.0.0` |

Other types (`chore`, `docs`, `refactor`, `test`, `ci`, `style`, `build`) are valid but trigger no
release. Suggested scopes: `ios`, `backend`, `frontend`, `android`, `ds`.

Enable the local commit-message hook once, from the repo root:

```bash
npm install
```

PR titles are validated too — squash-merging uses the PR title as the commit message on `main`.

### App version (iOS)

`athly-ios/Config/Version.xcconfig` is the single source of truth and is **generated — do not edit
by hand**:

```
MARKETING_VERSION = 1.4.0        -> CFBundleShortVersionString
CURRENT_PROJECT_VERSION = 12     -> CFBundleVersion (build, always increasing)
```

It is included from `Config/Config.xcconfig`, so both the app and the Live Activity extension pick
it up via `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)` in their Info.plist (see
`athly-ios/project.yml`). Nothing else in the Xcode project changes per release, so
`xcodegen generate` stays safe to run at any time.

### Useful commands

```bash
npm run release:dry   # preview the next version and release notes, changes nothing
```

## License

- **Backend**: UNLICENSED (private use)
- **Frontend**: MIT
