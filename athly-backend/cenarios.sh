#!/usr/bin/env bash
# Cenários do planner no simulador do iPhone: ver prisma/cenarios/cli.ts.
set -euo pipefail
cd "$(dirname "$0")"
NODE22="$HOME/.nvm/versions/node/v22.22.0/bin"
[ -d "$NODE22" ] && export PATH="$NODE22:$PATH"
exec node_modules/.bin/ts-node --transpile-only prisma/cenarios/cli.ts "$@"
