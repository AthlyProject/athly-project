---
tags: [tipo/integracao, integracao/strava, contexto/produto]
status: done
created: 2026-04-24
---

# Strava — Modal Obrigatória (StravaAuthModal)

## Propósito

Bloquear geração de plano até que Strava esteja conectado (ou usuário escolha Assessment Plan).

---

## Fluxo

```
Usuário clica "Gerar Novo Plano"
  ↓
Sistema valida: Integration.stravaAccessToken existe?
  ├─ SIM  → Processa (POST /training-plans/generate)
  └─ NÃO  → Abre Modal StravaAuthModal
            ├─ "Conecte Strava para começar"
            ├─ [Botão] "Conectar Strava"
            └─ [Botão] "Usar Plano Padrão (Assessment Plan)"
                ↓
                Se Conectar → OAuth flow (TASK-004)
                Se Assessment Plan → POST /training-plans/generate?useDefault=true
```

---

## Modal Component

```tsx
export interface StravaAuthModalProps {
  isOpen: boolean;
  onConnect: () => void;      // → OAuth flow
  onSkip: () => void;         // → Assessment Plan
  onClose: () => void;        // → Cancel
}

export function StravaAuthModal(props: StravaAuthModalProps) {
  return (
    <Modal isOpen={props.isOpen}>
      <h2>Conecte Strava para começar</h2>
      <p>Athly usa seu histórico real para gerar planos personalizados.</p>
      
      <img src="/strava-logo.svg" alt="Strava" />
      
      <Button onClick={props.onConnect} primary>
        🔗 Conectar Strava
      </Button>
      
      <Button onClick={props.onSkip} secondary>
        Ou usar Plano Padrão
      </Button>
      
      <Button onClick={props.onClose}>Cancelar</Button>
    </Modal>
  );
}
```

---

## Quando Aparecer

1. **Ao clicar "Gerar Novo Plano"** (sem Strava)
2. **Na primeira visita ao dashboard** (se novo usuário e sem Strava)
3. **Ao tentar editar workouts** (sem histórico para contexto)

---

## Assessment Plan Fallback

Se usuário clica "Usar Plano Padrão":

```
POST /training-plans/generate?useDefault=true
  ↓
Sistema:
  - Não busca Strava (pode não estar conectado)
  - Usa preferências coletadas no onboarding
  - Gera plano com 5 workouts genéricos
  - source = "ai" (mas sem contexto Strava)
  ↓
Exibe plano com warning: "Plano padrão. Conecte Strava para personalização."
```

---

## Referências

- [[Proposta de Valor]]
- [[ADR-006 - Fallback Assessment Plan sem Strava]]
- TASK-020
- [[Strava - Fluxo OAuth]]
