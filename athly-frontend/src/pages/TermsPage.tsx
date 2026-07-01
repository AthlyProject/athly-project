import { LegalDocPage } from "@/components/legal/LegalDocPage";
import { termsDoc } from "@/config/legalContent";

export function TermsPage() {
  return <LegalDocPage docs={termsDoc} documentTitle="Termos de Uso - Athly" />;
}
