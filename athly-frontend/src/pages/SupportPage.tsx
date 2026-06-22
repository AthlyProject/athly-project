import { LegalDocPage } from "@/components/legal/LegalDocPage";
import { supportDoc } from "@/config/legalContent";

export function SupportPage() {
  return <LegalDocPage docs={supportDoc} documentTitle="Suporte - Athly" />;
}
