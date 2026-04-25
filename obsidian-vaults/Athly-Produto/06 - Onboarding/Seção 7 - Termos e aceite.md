---
tags: [tipo/onboarding, contexto/produto]
status: done
created: 2026-04-24
---

# Seção 7 — Termos e Aceite

## Objetivo

Obter consentimento legal (privacidade, termos) e preferências de notificação.

---

## Checkboxes Obrigatórias

### 1. Li e aceito os Termos de Serviço

**Tipo:** Checkbox + Link

- [ ] Concordo com os [[Termos de Serviço]] (link)

**Validação:** OBRIGATÓRIO

**Uso:** `termsAccepted = true` em User

---

### 2. Li e aceito a Política de Privacidade

**Tipo:** Checkbox + Link

- [ ] Concordo com a [[Política de Privacidade]] (link)

**Validação:** OBRIGATÓRIO

**Uso:** `privacyAccepted = true` em User

---

## Preferências de Notificação (Opcionais)

### 3. Receber notificações de novo plano (seg 6h)

**Tipo:** Checkbox

- [x] Quero receber push + email toda semana

**Default:** Checked (opt-out)

**Uso:** `notifyNewPlan = true` em UserPreference

---

### 4. Receber dicas e insights

**Tipo:** Checkbox

- [ ] Sim, dicas e motricidade semanal

**Default:** Unchecked (opt-in)

**Uso:** `notifyInsights = true` em UserPreference

---

### 5. Receber ofertas (futuro)

**Tipo:** Checkbox

- [ ] Sim, sobre novos recursos e ofertas

**Default:** Unchecked

**Uso:** `notifyMarketing = true` em UserPreference

---

## Botões Finais

**[Botão] Finalizar Onboarding**

Clique valida:
- ✅ Termos checkbox checked
- ✅ Privacidade checkbox checked
- ✅ POST /users/preferences (salva tudo)
- ✅ Redirect /dashboard

---

## Fluxo Final

```
"Finalizar" click
  ↓
Validações todas OK?
  ├─ NÃO → Mostrar erro em vermelho
  └─ SIM:
      POST /users/preferences
        {
          user: {name, email, whatsapp, birthDate, gender, weight, height},
          preferences: {distanceTarget, timeFrameWeeks, availability, goals, ...},
          health: {parq_q1-7, chronicPain, sleepQuality, ...},
          notifications: {notifyNewPlan, notifyInsights, notifyMarketing},
          termsAccepted: true,
          privacyAccepted: true,
          acceptedAt: now()
        }
      ↓
      201 Created
      ↓
      Redirect /dashboard
      ↓
      Modal: "Conectar Strava para começar?"
```

---

## Armazenamento

```
User table:
  termsAccepted, privacyAccepted, acceptedAt

UserPreference table:
  notifyNewPlan, notifyInsights, notifyMarketing
```

---

## Referências

- Próxima: Dashboard + [[Strava - Modal obrigatória (StravaAuthModal)]]
