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
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // O corpo costuma ter URLs, stack traces e trechos de log que nao dao para
    // quebrar em 100 colunas. O commit de release gerado pelo semantic-release
    // tambem embute as release notes (links de commit bem longos) no corpo.
    // O limite do header (100) continua valendo — ali a concisao importa.
    'body-max-line-length': [0, 'always'],
    'footer-max-line-length': [0, 'always'],
  },
};
