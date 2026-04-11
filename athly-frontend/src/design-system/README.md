# Athly Design System

Sistema de design futurista e esportivo para o app de treinos com IA.

## 🎨 Identidade Visual

- **Mascote**: Raposa neon
- **Cores principais**: Azul neon → Roxo neon (gradientes)
- **Estilo**: Futurista, tecnológico, esportivo, premium
- **Modo**: Dark-first (otimizado para modo escuro)

## 🎯 Princípios

1. **Performance visual**: Transmitir velocidade e movimento
2. **Tecnologia**: Aparência moderna com elementos neon
3. **Clareza**: Interface limpa e hierarquia visual forte
4. **Mobile-first**: Otimizado para dispositivos móveis

## 📦 Estrutura

```
src/design-system/
├── tokens.ts          # Tokens de design (cores, espaçamentos, etc)
└── README.md          # Esta documentação
```

## 🎨 Paleta de Cores

### Primary (Azul Neon)
```css
--color-primary-400: #0ea5e9
--color-primary-500: #0284c7 (main)
--color-primary-neon: #00d4ff
```

### Secondary (Roxo Neon)
```css
--color-secondary-500: #a855f7 (main)
--color-secondary-neon: #bf40ff
```

### Background (Dark-first)
```css
--color-background-dark: #0a0a0f
--color-surface-card: #1a1a24
```

### Gradientes
```css
--gradient-primary: linear-gradient(135deg, #0ea5e9 0%, #a855f7 100%)
--gradient-neon: linear-gradient(135deg, #00d4ff 0%, #bf40ff 100%)
```

## 🧩 Componentes Base

### Button
```tsx
import { Button } from '@/components/ui/Button'

// Variantes
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="gradient">Gradient</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>

// Com glow
<Button glow>Com efeito neon</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
```

### Card
```tsx
import { Card } from '@/components/ui/Card'

// Variantes
<Card variant="default">Default</Card>
<Card variant="gradient">Com gradiente</Card>
<Card variant="glow">Com borda neon</Card>
<Card variant="flat">Sem borda</Card>

// Padding
<Card padding="sm">Small padding</Card>
<Card padding="md">Medium padding</Card>
<Card padding="lg">Large padding</Card>
```

### Input
```tsx
import { Input } from '@/components/ui/Input'

<Input 
  label="Email" 
  placeholder="seu@email.com"
  error="Campo obrigatório"
/>

// Com ícone
<Input 
  icon={<SearchIcon />}
  placeholder="Buscar..."
/>
```

### Badge
```tsx
import { Badge } from '@/components/ui/Badge'

<Badge variant="primary">Novo</Badge>
<Badge variant="neon">Premium</Badge>
<Badge variant="success">Completo</Badge>
```

### GradientText
```tsx
import { GradientText } from '@/components/ui/GradientText'

<h1>
  <GradientText animated>Athly</GradientText>
</h1>

<GradientText variant="neon">Neon Text</GradientText>
```

## 🎭 Classes Utilitárias

### Gradientes
```tsx
<div className="gradient-primary">Gradiente primário</div>
<div className="gradient-neon">Gradiente neon</div>
<div className="text-gradient">Texto com gradiente</div>
```

### Glow Effects
```tsx
<div className="glow-primary">Brilho azul</div>
<div className="glow-secondary">Brilho roxo</div>
<div className="glow-both">Brilho combinado</div>
```

### Animações
```tsx
<div className="animate-pulse-glow">Pulso suave</div>
<div className="animate-gradient">Gradiente animado</div>
```

## 📐 Espaçamento

```css
--space-xs: 0.25rem     /* 4px */
--space-sm: 0.5rem      /* 8px */
--space-md: 1rem        /* 16px */
--space-lg: 1.5rem      /* 24px */
--space-xl: 2rem        /* 32px */
--space-2xl: 3rem       /* 48px */
```

## 🔤 Tipografia

### Font Family
```css
--font-sans: "DM Sans" (corpo)
--font-display: "Space Grotesk" (títulos)
```

### Font Size
```css
text-sm:   0.875rem  /* 14px */
text-base: 1rem      /* 16px */
text-lg:   1.125rem  /* 18px */
text-xl:   1.25rem   /* 20px */
text-2xl:  1.5rem    /* 24px */
text-3xl:  1.875rem  /* 30px */
text-4xl:  2.25rem   /* 36px */
```

## 🌙 Dark Mode

O design é **dark-first**. Todas as cores e componentes foram pensados para modo escuro.

## 📱 Responsive

Breakpoints:
```css
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
```

## 🎯 Exemplos de Uso

### Dashboard Card
```tsx
<Card variant="gradient" padding="lg">
  <GradientText variant="neon" animated>
    <h2 className="text-3xl">Seu treino de hoje</h2>
  </GradientText>
  <p className="text-[var(--color-text-secondary)] mt-4">
    Corrida intervalada • 45 min
  </p>
  <Button variant="gradient" fullWidth className="mt-6" glow>
    Iniciar treino
  </Button>
</Card>
```

### Stat Card
```tsx
<Card variant="glow">
  <Badge variant="neon">Premium</Badge>
  <h3 className="text-2xl mt-4 text-gradient">12.5 km</h3>
  <p className="text-[var(--color-text-tertiary)]">
    Distância percorrida
  </p>
</Card>
```

## 🚀 Próximos Passos

- [ ] Adicionar componente Toast
- [ ] Adicionar componente Modal
- [ ] Adicionar componente Tabs
- [ ] Adicionar componente BottomNav
- [ ] Adicionar animações de transição entre telas
- [ ] Adicionar componente ProgressBar com gradiente

## 📝 Notas

- Sempre use as variáveis CSS ao invés de valores hardcoded
- Prefira `var(--color-*)` para consistência
- Use `rounded-xl` ou `rounded-2xl` para bordas modernas
- Adicione `transition-all duration-300` para suavizar transições
- Use `glow` com moderação para não poluir a interface
