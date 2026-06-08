# 01 — Design System (tema Compose espelhando o iOS)

## 1. Objetivo
Recriar o design system do iOS em Compose Material3: cores exatas, tipografia SpaceGrotesk, spacing,
radius, gradientes e os componentes reutilizáveis (card, botões, text field).

## 2. Stack & convenções
Ver `README.md`. Tudo em `core/designsystem/`. Dark mode forçado. Exponha via `AthlyTheme { }` + um
objeto `AthlyTokens`/`MaterialTheme` acessível nos Composables.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Utils/Theme.swift`
- `/Users/.../AthlyRunner/Utils/ButtonStyles.swift`
- `/Users/.../AthlyRunner/Utils/TextFieldStyles.swift`

## 4. Alvo Android (criar em `core/designsystem/`)
`theme/Color.kt`, `theme/Type.kt`, `theme/Shape.kt`, `theme/Theme.kt`, `component/` (AthlyCard, botões, text field).

### Cores (hex EXATOS — `theme/Color.kt`)
| Token | Hex |
|---|---|
| primary (cyan) | `#06b6d4` |
| primaryNeon | `#00d4ff` |
| secondary (purple) | `#9d25f4` |
| secondaryNeon | `#bf40ff` |
| accent (pink) | `#f472b6` |
| backgroundDark | `#0a0a10` |
| surfaceDark | `#0d1117` |
| surfaceCard | `#141820` |
| borderDark | branco @ 10% |
| glassBackground | cyan @ 5% |
| glassBorder | branco @ 10% |
| textPrimary | `#f9fafb` |
| textSecondary | `#d1d5db` |
| textTertiary | `#9ca3af` |
| success | `#10b981` |
| warning | `#f59e0b` |
| error | `#ef4444` |

### Gradientes (todos topLeading → bottomTrailing = `Brush.linearGradient` start TopStart → end BottomEnd)
- **brand:** cyan → purple. **neon:** primaryNeon → secondaryNeon.
- **cardBackground:** surfaceCard → surfaceDark.
- **gradientBorder:** cyan @ 30% → purple @ 30%.
- **insightBackground:** cyan @ 20% → backgroundDark → accent @ 20%.

### Tipografia (`theme/Type.kt`) — `FontFamily` SpaceGrotesk (`res/font`: regular/medium/semibold/bold)
Helpers espelhando o iOS: `heading(size)`=Bold, `semibold(size)`, `medium(size)`, `body(size=16)`=Regular,
`label()`=SemiBold 11sp. Exponha como funções utilitárias ou um `AthlyType` com `TextStyle`s.

### Spacing & Radius
`Spacing`: sm=16.dp, md=24.dp, lg=32.dp. `Radius`: card=24.dp, button=16.dp, small=12.dp.

### Componentes (`component/`)
- **AthlyCard** (`Modifier.athlyCard(glow=false)` ou Composable): base surfaceCard + overlay gradiente
  (cyan @12% + purple @4%), borda gradiente (cyan/purple @30%) 1.dp (ou neon 1.5.dp se glow), shadow
  cyan @18% (glow @30%), corner 24.dp.
- **AthlyInsightCard:** igual, com `insightBackground` + borda 1.5.dp + shadow cyan @35%.
- **Botões** (espelhar `ButtonStyles.swift`): `AthlyPrimaryButton` (cyan sólido), `AthlyGradientButton`
  (gradiente brand + shadow cyan @50%, press @20%), `AthlySecondaryButton` (surfaceCard + borda gradiente),
  `AthlyDangerButton` (error). Corner 16.dp, press: opacity 0.8 / scale 0.97, anim easeOut 150ms.
- **AthlyTextField:** padding h16/v14, bg surfaceCard, borda cyan 1.5.dp quando focado / glassBorder 1.dp,
  radius 12.dp, cursor cyan.

## 5. Contrato de dados
N/A.

## 6. Escopo
**In:** tema + componentes + uma tela `DesignSystemPreviewScreen` (debug) mostrando cards/botões/campos.
**Fora:** telas de feature.

## 7. Dependências
`00-foundation`.

## 8. Critérios de aceite
- `AthlyTheme { }` aplica fundo `#0a0a10`, textos SpaceGrotesk.
- Preview/Composable demo mostra os 4 botões, AthlyCard, AthlyInsightCard e o text field idênticos ao iOS.
- Cores conferem com a tabela (use os hex exatos).

## 9. Pitfalls
- `res/font` exige nomes em snake_case minúsculo. Cadastre os 4 pesos.
- Compose não tem "press scale" nativo nos botões — implemente via `interactionSource` + `graphicsLayer`.
- Shadows coloridas no Compose: use `Modifier.shadow(..., ambientColor/spotColor)` (API 28+) ou desenhe no `drawBehind`.
- Gradiente topLeading→bottomTrailing = `start = Offset(0,0)`, `end = Offset.Infinite` no `linearGradient`.
