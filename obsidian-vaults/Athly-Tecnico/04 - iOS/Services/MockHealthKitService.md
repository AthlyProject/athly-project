---
tags: [tipo/servico, camada/ios, dominio/healthkit]
tipo: servico
camada: ios
arquivo: AthlyRunner/Services/MockHealthKitService.swift
status: implementado
created: 2026-04-24
---

# MockHealthKitService

## Propósito
Implementação mock de [[HealthKitService]] usada em SwiftUI Previews, testes unitários e simulador (onde HealthKit não tem dados reais).

## API pública
Mesma interface de [[HealthKitService]] — retorna arrays fixos de [[HealthKitRunItem]] sintéticos.

## Dependências
- Nenhuma (puro Swift, sem HealthKit)

## Consumido por
- Previews de [[Profile e HealthKit Views]]
- Target de testes

## Notas
- Permite desenvolver UI da [[HealthKitRunsViewModel]] sem depender de Apple Watch
- Dados de exemplo calibrados com ranges realistas (5-15 km, 5:00-6:30 pace)
