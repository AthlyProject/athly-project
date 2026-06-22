import { LegalDocPage } from "@/components/legal/LegalDocPage";
import { privacyDoc } from "@/config/legalContent";

export function PrivacyPage() {
  return <LegalDocPage docs={privacyDoc} documentTitle="Política de Privacidade - Athly" />;
}
