/**
 * Conventional Commits — o mesmo formato que o semantic-release le para
 * calcular a proxima versao (ver .releaserc.json).
 *
 *   feat: ...            -> minor
 *   fix: / perf: ...     -> patch
 *   BREAKING CHANGE: ... -> major
 *
 * Escopos sao livres; os sugeridos sao: ios, backend, frontend, android, ds.
 * Merge commits sao ignorados pelo commitlint por padrao.
 */
export default { extends: ['@commitlint/config-conventional'] };
