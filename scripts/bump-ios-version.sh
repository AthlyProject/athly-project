#!/usr/bin/env bash
#
# Escreve a versao do release no app iOS.
#
# Chamado pelo semantic-release (@semantic-release/exec) com a proxima versao:
#   ./scripts/bump-ios-version.sh 1.4.0
#
# MARKETING_VERSION vira CFBundleShortVersionString e CURRENT_PROJECT_VERSION
# vira CFBundleVersion (ver athly-ios/project.yml). O build number e um contador
# que so cresce — a App Store exige que cada upload tenha build maior que o anterior.
#
# O arquivo e reescrito por inteiro de proposito: `sed -i` tem sintaxe diferente
# no BSD (macOS) e no GNU (CI ubuntu).
set -euo pipefail

VERSION="${1:?usage: bump-ios-version.sh <x.y.z>}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "erro: CFBundleShortVersionString precisa ser x.y.z numerico, recebido '$VERSION'" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$REPO_ROOT/athly-ios/Config/Version.xcconfig"

CURRENT_BUILD="$(grep -E '^[[:space:]]*CURRENT_PROJECT_VERSION' "$CONFIG" | head -1 | sed 's/.*=//' | tr -d '[:space:]')"

if [[ ! "$CURRENT_BUILD" =~ ^[0-9]+$ ]]; then
  echo "erro: CURRENT_PROJECT_VERSION invalido em $CONFIG: '$CURRENT_BUILD'" >&2
  exit 1
fi

NEXT_BUILD=$(( CURRENT_BUILD + 1 ))

cat > "$CONFIG" <<INNER
// Gerado automaticamente pelo semantic-release. Nao editar a mao.
// MARKETING_VERSION       -> CFBundleShortVersionString (ex: 1.4.0)
// CURRENT_PROJECT_VERSION -> CFBundleVersion (build, sempre crescente)
MARKETING_VERSION = ${VERSION}
CURRENT_PROJECT_VERSION = ${NEXT_BUILD}
INNER

echo "iOS version -> ${VERSION} (build ${NEXT_BUILD})"
