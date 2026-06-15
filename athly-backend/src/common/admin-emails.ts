/**
 * Lista de e-mails de admin/dev vem da env `ADMIN_EMAILS` (separada por vírgula).
 * Esses e-mails têm acesso a endpoints admin E são isentos do paywall (ver BillingService.isEntitled).
 * Centralizado aqui para o `AdminEmailGuard` e o `BillingService` não divergirem.
 */
export function isAdminEmail(
  email: string | undefined | null,
  adminEmailsRaw: string | undefined,
): boolean {
  if (!email) return false;
  const allowed = (adminEmailsRaw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  return allowed.includes(email.toLowerCase());
}
