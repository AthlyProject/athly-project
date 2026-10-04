/**
 * Versão vigente de cada documento legal — a data de "última atualização" publicada em
 * athlyproject.app/terms e /privacy (athly-frontend/src/config/legalContent.ts).
 *
 * Ao publicar uma nova versão de um documento, atualize a data aqui também: todo usuário
 * que aceitou uma versão anterior passa a ter `legalConsentRequired = true` e o app pede
 * um novo aceite antes de liberar o uso.
 */
export const LEGAL_DOCUMENT_VERSIONS = {
  terms: '2026-06-30',
  privacy: '2026-06-22',
} as const;
