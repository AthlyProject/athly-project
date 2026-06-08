# Athly - AI-Powered Workout Planning

AI-generated workout planning application. Mocked front-end, ready for integration with a real backend.

## Stack

- **Vite.js** - Build tool
- **React 19** + **TypeScript**
- **React Router** - Navigation
- **TailwindCSS 4** - Styling
- **Zustand** - Global state
- **Apollo Client** + **GraphQL** - Set up for requests (mocks active)
- **React Hot Toast** - Notifications

## Structure 

```
src/
  app/          - Application configuration
  components/   - Reusable components
  pages/        - Pages/routes
  services/     - API, GraphQL, mocked services
  hooks/        - Custom hooks
  store/        - Zustand stores
  layouts/      - MainLayout, AuthLayout
  mocks/        - Mock data
  types/        - TypeScript types
  router/       - Route configuration
```

## Routes

| Route | Description |
|-------|-------------|
| `/login` | Mocked login |
| `/dashboard` | Dashboard with today's workout |
| `/plan` | Weekly training plan |
| `/workout/:id` | Workout details |
| `/feedback/:id` | Post-workout feedback |
| `/history` | Workout history |
| `/profile` | Profile and preferences |
| `/settings` | Settings and integrations |

## How to run

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Preview build
npm run preview
```

## Mocked login

Use any email and password to sign in. Login does not validate credentials.

## Future integration

To connect with a real backend:

1. Configure `VITE_API_URL` and `VITE_GRAPHQL_URL` in `.env`
2. Set `VITE_USE_REAL_API=true` to use the real API
3. Services in `/services` are already structured to swap mocks for real calls
4. Apollo Client is already configured in `/services/graphql/client.ts`

## License

MIT
