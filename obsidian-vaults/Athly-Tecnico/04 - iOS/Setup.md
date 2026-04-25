---
tags: [camada/ios, tipo/documento]
camada: ios
tipo: documento
status: implementado
created: 2026-04-24
---

# Setup iOS

## Requisitos

- Xcode 15+
- Swift 5.9+
- iOS 16.0+ target
- Signing: Apple Developer account

## SPM dependencies

Zero (!)

## Info.plist

- NSLocationWhenInUseUsageDescription
- NSHealthShareUsageDescription
- NSHealthUpdateUsageDescription

## Build

```bash
xcodebuild -scheme Athly -configuration Release
```

## Signing

Apple Developer account required for:
- Pushing notifications (APNs)
- HealthKit entitlements
- Activity Kit entitlements

---

Ver: [[_MOC iOS]]
