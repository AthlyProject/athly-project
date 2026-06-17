export const companyInfo = {
  brandName: "Athly",
  productName: "Athly Project",
  domainName: "athlyproject.app",
  websiteUrl: "https://athlyproject.app",
  legalEntityName: "AFJ DESENVOLVIMENTO DE SISTEMAS LTDA",
  registrationLabel: "CNPJ",
  registrationNumber: "36.794.171/0001-87",
  registeredAddress: "R. ARTHUR HIPÓLITO BISSE, 63",
  country: "Brazil",
  legalEmail: "support@athlyproject.app",
  supportEmail: "support@athlyproject.app",
} as const;

export const companyDisclosure =
  `${companyInfo.productName} is operated by ${companyInfo.legalEntityName}. ` +
  `${companyInfo.websiteUrl} is the official public website for ${companyInfo.productName}.`;
