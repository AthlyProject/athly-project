#!/usr/bin/env bash
# Gate de build por slice — um slice SÓ é considerado concluído se este script sair verde (exit 0).
#
# Uso: ./check_slice.sh [nome-do-slice]
#   ./check_slice.sh 09-run-summary
#
# Roda `assembleDebug testDebugUnitTest` e valida DUAS coisas:
#   1. o exit code REAL do gradle (sem pipe no meio — `gradlew | tail` retorna o exit do tail
#      e já mascarou falha de build neste projeto);
#   2. o texto "BUILD SUCCESSFUL" no log (cinto e suspensório).
# Em falha, imprime os erros de compilação/teste e sai com 1.

set -u

SLICE="${1:-}"
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$DIR/build/check_slice.log"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

mkdir -p "$DIR/build"

"$DIR/gradlew" -p "$DIR" assembleDebug testDebugUnitTest --console=plain >"$LOG" 2>&1
EXIT=$?

label="SLICE${SLICE:+ $SLICE}"

if [ "$EXIT" -eq 0 ] && grep -q "BUILD SUCCESSFUL" "$LOG"; then
    RESULTS_DIR="$DIR/app/build/test-results/testDebugUnitTest"
    TESTS=$(grep -hoE 'tests="[0-9]+"' "$RESULTS_DIR"/*.xml 2>/dev/null | grep -oE '[0-9]+' | paste -sd+ - | bc)
    FAILURES=$(grep -hoE 'failures="[0-9]+"' "$RESULTS_DIR"/*.xml 2>/dev/null | grep -oE '[0-9]+' | paste -sd+ - | bc)
    if [ "${FAILURES:-0}" != "0" ]; then
        # Não deveria acontecer (gradle falharia), mas se os XMLs discordarem, é vermelho.
        echo "❌ $label RED — BUILD SUCCESSFUL mas ${FAILURES} teste(s) falhando nos XMLs. Log: $LOG"
        exit 1
    fi
    echo "✅ $label GREEN — BUILD SUCCESSFUL, ${TESTS:-0} testes, 0 falhas"
    exit 0
else
    echo "❌ $label RED — build falhou (exit $EXIT). Erros:"
    grep -E "^e: |^> Task .* FAILED|FAILURE:|failed," "$LOG" | head -20
    echo "Log completo: $LOG"
    exit 1
fi
