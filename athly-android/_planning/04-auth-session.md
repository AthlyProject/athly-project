# 04 — Auth (Login/Register) + sessão + splash

## 1. Objetivo
Telas de Login/Registro, restauração de sessão no cold start (Keychain→TokenStore) e splash de abertura,
com gate de autenticação observando o evento de "sessão expirada" do `TokenAuthenticator` (02).

## 2. Stack & convenções
Ver `README.md`. UI em `feature/auth/ui/`, ViewModel `@HiltViewModel` em `feature/auth/`. Compose Material3,
dark forçado, `collectAsStateWithLifecycle()`. Strings pt-BR idênticas.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/ViewModels/AuthViewModel.swift`
- `/Users/.../AthlyRunner/Views/Auth/LoginView.swift`
- `/Users/.../AthlyRunner/Views/Auth/RegisterView.swift`
- `/Users/.../AthlyRunner/Views/RootView.swift` (splash + restauração de sessão + gate)
- `/Users/.../AthlyRunner/AthlyRunnerApp.swift` (composição de ambiente; dark forçado)
> **Comportamento:**
> - **AuthViewModel** expõe `isAuthenticated`, `isLoading`, `errorMessage`, `userName`,
>   `hasFinishedInitialSessionRestore`. No `init`: carrega tokens salvos; se existirem, seta `setTokens` no
>   client + `isAuthenticated=true`; em qualquer caso seta `hasFinishedInitialSessionRestore=true` ao fim.
>   Observa o evento de tokens renovados e re-salva. `login`/`register` chamam o repo, salvam tokens, setam
>   `isAuthenticated`; `register` também guarda `weightKg` (UserMetrics) e `userName`. `logout`/`deleteAccount`
>   limpam tokens + cache do plano + `isAuthenticated=false` (deleteAccount chama `DELETE /users/me` antes).
> - **RootView**: `ZStack` com `MainTabView`/`LoginView` por baixo (opacity 0 enquanto splash) e o splash por
>   cima. Splash visível por **no mínimo 850ms** E até `hasFinishedInitialSessionRestore` — só some quando
>   **ambos** verdadeiros (`dismissLaunchSplashIfReady`). Logo `AthlyLogo` 112pt, fade/scale-in, radial
>   gradient `primary.opacity(0.12)→backgroundDark`. Transições easeInOut 0.3–0.35.
> - **LoginView**: logo 100pt + título "Athly Runner" (gradiente brand) + subtítulo "Seu tracker de corrida
>   inteligente". Campos: Email (keyboard email, sem auto-cap), "Senha" (secure). Erro em vermelho. Botão
>   "Entrar" (gradiente) desabilitado se email/senha vazios ou loading (opacity 0.6). Link "Criar conta" →
>   sheet `RegisterView`.
> - **RegisterView** (sheet, scroll): título "Criar conta" + "Comece a registrar suas corridas". Campos:
>   "Nome completo", "Username" (sem auto-cap), "Email", "Senha (mínimo 8 caracteres)" (secure),
>   "Confirmar senha" (secure) — erro "As senhas não coincidem" se preenchido e diferente; "Data de
>   nascimento" (DatePicker → string `yyyy-MM-dd`), "Peso (kg)" (decimal), "Altura (cm)" (decimal). Botão
>   "Registrar" habilitado só com `isFormValid` (nome, username, email, senhas coincidem, peso, altura todos
>   preenchidos). Toolbar "Cancelar" → dismiss. Ao autenticar, fecha o sheet.

## 4. Alvo Android
### `feature/auth/AuthViewModel.kt` (`@HiltViewModel`)
- `StateFlow<AuthUiState>` com `isAuthenticated`, `isLoading`, `errorMessage`, `userName`,
  `hasFinishedInitialSessionRestore`. Injeta `AuthRepository` (02), `TokenStore` (02), `SessionEventBus` (02).
- `restoreSession()` chamado no `init`: lê `TokenStore.accessToken()/refreshToken()`; se ambos presentes →
  `isAuthenticated=true` (opcional: validar com `GET /users/me`); sempre seta `hasFinishedInitialSessionRestore=true`.
- `login(email,password)`, `register(...)`, `logout()`, `deleteAccount()` → `Result<T>` do repo; em sucesso
  salvam tokens (o repo/store já fazem) e atualizam o state. `register` persiste peso em DataStore (UserMetrics)
  e seta `userName`.
- **Coleta o evento "sessão expirada"** do `SessionEventBus` (Channel/SharedFlow do 02): ao receber → limpa state
  e seta `isAuthenticated=false` (desloga). Substitui o `NotificationCenter` do iOS.

### Composables (`feature/auth/ui/`)
- `LaunchSplashScreen.kt`: logo + radial gradient; anima fade/scale-in. Sem lógica de tempo (a do gate fica no Nav/Root).
- `LoginScreen.kt`, `RegisterScreen.kt`: stateless, recebem state + callbacks; usam `AthlyTextField`,
  `AthlyGradientButton` (01). Validação de formulário no Composable/VM (senha **min 8**, match, campos
  obrigatórios). Registro como destino/dialog full-screen (equivalente ao sheet).

### Gate de splash (no Root/Nav — coordenar com 05)
- Splash mostrado por `max(850ms, até hasFinishedInitialSessionRestore)`. Use um `delay(850)` + flag; só
  esconde quando **ambos** prontos (espelha `dismissLaunchSplashIfReady`).

### Mapeamento de plataforma
| iOS | Android |
|---|---|
| Keychain | `TokenStore` (EncryptedSharedPreferences, 02) |
| `NotificationCenter` (.athlyTokensRefreshed / sessão expirada) | `SessionEventBus` (SharedFlow/Channel, 02) |
| `@Published` / `ObservableObject` | `StateFlow<AuthUiState>` / `ViewModel` |
| `.sheet(RegisterView)` | destino de navegação / dialog full-screen |
| `DatePicker` → `yyyy-MM-dd` | `DatePicker` Material3 → `LocalDate.toString()` |
| `UserMetrics.weightKg` | DataStore (prefs) |

## 5. Contrato de dados
`AuthRepository.login/register/deleteAccount` e DTOs `LoginRequest`/`RegisterRequest`/`AuthResponse` (02).
`RegisterRequest`: name, username, email, password, confirmPassword, dateOfBirth (`yyyy-MM-dd`), weight (kg),
height (cm) — bater nomes/snake_case com o backend.

## 6. Escopo
**In:** AuthViewModel + estado, telas de Login/Register, splash, restauração de sessão, observação de sessão
expirada, persistência de peso/userName. **Fora:** networking/token store (02), bottom nav e roteamento entre
grafos (05), demais features.

## 7. Dependências
`02-networking-dtos`, `01-design-system`.

## 8. Critérios de aceite
- Compila. Login válido → `isAuthenticated=true` e navega para o app; credenciais erradas → `errorMessage`.
- Registro com senhas que não coincidem ou campos faltando → botão desabilitado; senha < 8 → bloqueado.
- Cold start com tokens válidos salvos → entra autenticado **após** o splash (mínimo 850ms respeitado).
- Disparar "sessão expirada" (refresh inválido no 02) → app volta para o Login.
- Splash nunca pisca antes de 850ms nem some antes de `hasFinishedInitialSessionRestore`.

## 9. Pitfalls
- O splash precisa de **duas** condições (tempo mínimo **e** restauração concluída) — não esconder só por uma.
- Restauração roda no `init`/cold start; sempre setar `hasFinishedInitialSessionRestore=true` mesmo sem tokens.
- `dateOfBirth` é **string `yyyy-MM-dd`**, não ISO com hora.
- Não duplicar a lógica de refresh aqui — só **observar** o evento global do 02.
- Strings pt-BR idênticas ("Entrar", "Criar conta", "As senhas não coincidem", "Senha (mínimo 8 caracteres)"…).
