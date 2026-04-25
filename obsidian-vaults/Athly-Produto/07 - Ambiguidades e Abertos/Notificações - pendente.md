---
tags: [tipo/ambiguidade, contexto/produto, status/aberto]
status: done
created: 2026-04-24
---

# Ambiguidade — Notificações Pendente

## Pergunta

**Frequência e canal de notificações não está especificado. Como notificar usuário?**

---

## Contexto

MVP menciona notificações:
- Cron regenera plano semanal e "envia notificação"
- Onboarding oferece opções (notifyNewPlan, notifyInsights, notifyMarketing)
- Mas: canais (push/email/SMS) e templates não estão documentados

---

## Opções de Canal

### 1. Push Notification
**Prós:**
- Real-time
- Alta engagement
- Barato

**Contras:**
- Requer app instalado
- Permissão do usuário

### 2. Email
**Prós:**
- Sempre funciona (email universal)
- Professional
- Rastreável (open rate)

**Contras:**
- Latência (pode chegar em spam)
- Leve overhead

### 3. SMS/WhatsApp
**Prós:**
- Muito pessoal
- Alta taxa de leitura

**Contras:**
- Caro
- Requer validação de telefone

### 4. Hybrid
**Prós:**
- Flexibilidade do usuário
- Fallback se um canal falhar

**Contras:**
- Complexidade

---

## Frequência Proposta

| Tipo | Frequência | Canal |
| --- | --- | --- |
| **Novo plano** | Seg 6h | Push + Email |
| **Insights** | Opcional (mensal?) | Email |
| **Dicas** | Opcional (semanal?) | Push |
| **Marketing** | Opcional (esporádico) | Email |

---

## Próximos Passos

1. **Product decide:** Quais canais?
2. **Definir templates:** Textos de notificação
3. **Integrar:** SendGrid (email), Firebase (push)
4. **TASK Nova:** "Implementar sistema de notificações"

---

## Referências

- Seção 7: [[Seção 7 - Termos e aceite]]
- TASK-018 (cron)
