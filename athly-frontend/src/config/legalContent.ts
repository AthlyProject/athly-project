import { companyInfo } from "./company";

export type Lang = "pt" | "en";

export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "link"; label: string; href: string };

export interface LegalSection {
  id: string;
  heading: string;
  blocks: ContentBlock[];
}

export interface LegalDoc {
  badge: string;
  title: string;
  subtitle: string;
  lastUpdated?: string;
  sections: LegalSection[];
}

// Last updated date for the Privacy Policy. Keep in sync with the App Store submission.
const LAST_UPDATED_PT = "22 de junho de 2026";
const LAST_UPDATED_EN = "June 22, 2026";

// ---------------------------------------------------------------------------
// Privacy Policy
// ---------------------------------------------------------------------------

export const privacyDoc: Record<Lang, LegalDoc> = {
  pt: {
    badge: "Privacidade",
    title: "Política de Privacidade",
    subtitle:
      "Como o Athly coleta, usa, compartilha e protege seus dados pessoais no aplicativo Athly Runner e no site athlyproject.app.",
    lastUpdated: LAST_UPDATED_PT,
    sections: [
      {
        id: "controlador",
        heading: "1. Quem é o controlador dos dados",
        blocks: [
          {
            type: "p",
            text: "O aplicativo Athly Runner e o site athlyproject.app são operados por:",
          },
          {
            type: "list",
            items: [
              `Razão social: ${companyInfo.legalEntityName}`,
              `${companyInfo.registrationLabel}: ${companyInfo.registrationNumber}`,
              `Endereço: ${companyInfo.registeredAddress} — ${companyInfo.country === "Brazil" ? "Brasil" : companyInfo.country}`,
              `Contato e Encarregado (DPO): ${companyInfo.legalEmail}`,
            ],
          },
          {
            type: "p",
            text: "Para qualquer questão sobre privacidade ou para exercer seus direitos, escreva para o nosso contato abaixo.",
          },
          { type: "link", label: companyInfo.legalEmail, href: `mailto:${companyInfo.legalEmail}` },
        ],
      },
      {
        id: "dados-coletados",
        heading: "2. Dados que coletamos",
        blocks: [
          {
            type: "p",
            text: "Coletamos apenas os dados necessários para oferecer um plano de treino personalizado e acompanhar sua evolução:",
          },
          {
            type: "list",
            items: [
              "Dados de cadastro e identidade: nome, e-mail, nome de usuário, data de nascimento e senha.",
              "Dados físicos: peso e altura, usados para estimar calorias e personalizar seu treino.",
              "Dados de saúde e atividade física (Apple Saúde / HealthKit): treinos de corrida, frequência cardíaca (média, máxima e por trecho), distância, energia ativa e rotas de treino. Com a sua autorização, o Athly também grava suas corridas de volta no app Saúde.",
              "Dados de localização precisa (GPS): durante uma corrida ativa, registramos seu percurso em tempo real (latitude, longitude, altitude, velocidade, precisão e horário), inclusive em segundo plano com a tela bloqueada.",
              "Dados de desempenho do treino: ritmo (pace), parciais por quilômetro, trechos/segmentos, ganho de elevação, calorias, tipo de esporte e intensidade.",
              "Respostas do questionário de avaliação física (PAR-Q): histórico de atividade, dias disponíveis para treinar, melhores tempos, qualidade de sono e informações de prontidão para a atividade física, como dores crônicas. Esses são dados pessoais sensíveis de saúde.",
              "Metas: o texto livre que você escreve para descrever seus objetivos.",
              "Feedback de treino: nível de esforço, fadiga e se o treino foi concluído.",
              "Dados de assinatura: status da assinatura e identificadores fornecidos pela Apple e pela RevenueCat. Não temos acesso ao número do seu cartão.",
              "Dados técnicos e de diagnóstico: informações sobre falhas, registros de uso e identificadores de sessão, usados para manter o app estável e seguro.",
            ],
          },
        ],
      },
      {
        id: "finalidades",
        heading: "3. Como e por que usamos seus dados",
        blocks: [
          { type: "p", text: "Usamos seus dados para:" },
          {
            type: "list",
            items: [
              "Criar e ajustar seu plano de treino personalizado, inclusive com inteligência artificial.",
              "Registrar, exibir e analisar suas corridas e sua evolução.",
              "Gerenciar sua conta, autenticação e assinatura.",
              "Enviar comunicações transacionais (por exemplo, confirmação de conta e lembretes de treino).",
              "Garantir a segurança, prevenir fraudes e corrigir erros.",
            ],
          },
          {
            type: "p",
            text: "Bases legais (LGPD e GDPR): execução do contrato (prestação do serviço); consentimento, em especial para dados de saúde, localização, integração com o HealthKit e notificações; cumprimento de obrigação legal; e legítimo interesse para segurança e melhoria do serviço. Você pode retirar seu consentimento a qualquer momento.",
          },
        ],
      },
      {
        id: "ia",
        heading: "4. Inteligência artificial (Google Gemini)",
        blocks: [
          {
            type: "p",
            text: "O Athly usa inteligência artificial para gerar e ajustar seu plano de treino. Para isso, enviamos a um provedor de IA — o Google Gemini (modelo gemini-2.5-flash) — os dados necessários, como seu perfil, histórico de corridas, métricas de saúde relevantes, respostas do questionário e suas metas.",
          },
          {
            type: "p",
            text: "Esses dados são processados apenas para gerar suas recomendações de treino. Não usamos inteligência artificial para publicidade. O tratamento pelo Google segue os termos de uso de dados da API do Google. Caso você não concorde com esse processamento, não será possível gerar planos automáticos.",
          },
        ],
      },
      {
        id: "compartilhamento",
        heading: "5. Compartilhamento e operadores",
        blocks: [
          {
            type: "p",
            text: "Não vendemos seus dados pessoais e não os usamos para publicidade direcionada nem rastreamento entre aplicativos. Compartilhamos dados apenas com operadores que nos ajudam a prestar o serviço:",
          },
          {
            type: "list",
            items: [
              "Google (Gemini): geração do plano de treino por inteligência artificial.",
              "RevenueCat e Apple: processamento de assinaturas e compras.",
              "Apple Saúde (HealthKit): leitura e gravação de dados de saúde no seu dispositivo, sob sua autorização.",
              "Amazon Web Services (AWS): hospedagem da infraestrutura e envio de e-mails transacionais (AWS SES).",
            ],
          },
          {
            type: "p",
            text: "Recursos planejados ou opcionais: poderemos, no futuro, oferecer monitoramento de estabilidade (Sentry) e conexões opcionais com serviços de terceiros, como Strava e Garmin. Essas conexões só ocorrem se e quando você as autorizar expressamente, e atualizaremos esta Política antes de ativá-las.",
          },
          {
            type: "p",
            text: "Também podemos divulgar dados quando exigido por lei ou ordem judicial.",
          },
        ],
      },
      {
        id: "healthkit",
        heading: "6. Apple Saúde (HealthKit)",
        blocks: [
          {
            type: "p",
            text: "Os dados obtidos do Apple Saúde (HealthKit) são usados exclusivamente para registrar, exibir e analisar seus treinos dentro do Athly. Não usamos dados do HealthKit para publicidade ou marketing, e não os vendemos nem os divulgamos a terceiros para esses fins. Você pode revogar o acesso a qualquer momento em Ajustes > Saúde > Acesso e Dispositivos.",
          },
        ],
      },
      {
        id: "localizacao",
        heading: "7. Localização em segundo plano",
        blocks: [
          {
            type: "p",
            text: "Coletamos sua localização precisa apenas durante uma corrida ativa, para traçar seu percurso — inclusive em segundo plano, com a tela bloqueada, exibindo o indicador de localização do iOS. Não rastreamos sua localização fora de uma corrida. Você pode desativar o acesso em Ajustes > Privacidade e Segurança > Localização.",
          },
        ],
      },
      {
        id: "transferencia",
        heading: "8. Transferência internacional de dados",
        blocks: [
          {
            type: "p",
            text: "Alguns operadores (como Google e AWS) processam dados em servidores fora do Brasil, inclusive nos Estados Unidos. Adotamos salvaguardas adequadas para essas transferências, conforme a LGPD (art. 33) e o GDPR (cláusulas contratuais padrão).",
          },
        ],
      },
      {
        id: "seguranca",
        heading: "9. Armazenamento, segurança e retenção",
        blocks: [
          {
            type: "p",
            text: "Protegemos seus dados com criptografia em trânsito (HTTPS), armazenamento seguro de credenciais no Keychain do iOS e senhas protegidas por hashing no servidor. Mantemos seus dados enquanto sua conta estiver ativa. Ao excluir a conta, removemos seus dados pessoais associados, ressalvadas eventuais obrigações legais de retenção.",
          },
        ],
      },
      {
        id: "direitos",
        heading: "10. Seus direitos",
        blocks: [
          {
            type: "p",
            text: "Conforme a LGPD e o GDPR, você tem o direito de acessar, corrigir, excluir, portar e obter informações sobre seus dados, além de revogar consentimentos. Para exercê-los:",
          },
          {
            type: "list",
            items: [
              `Escreva para ${companyInfo.legalEmail}.`,
              "Exclua sua conta e todos os dados diretamente no app, em Perfil > Excluir conta.",
              "Revogue permissões de Saúde, Localização e Notificações nos Ajustes do iOS.",
            ],
          },
        ],
      },
      {
        id: "notificacoes",
        heading: "11. Notificações",
        blocks: [
          {
            type: "p",
            text: "Enviamos lembretes de treino por meio de notificações locais. Você pode desativá-las a qualquer momento nas preferências do app ou nos Ajustes do iOS.",
          },
        ],
      },
      {
        id: "idade",
        heading: "12. Idade mínima",
        blocks: [
          {
            type: "p",
            text: "O Athly não se destina a menores de 13 anos, e não coletamos intencionalmente dados dessas crianças. Se você for responsável por uma criança e acreditar que ela nos forneceu dados, entre em contato para que possamos removê-los.",
          },
        ],
      },
      {
        id: "cookies",
        heading: "13. Cookies e o site",
        blocks: [
          {
            type: "p",
            text: "O site athlyproject.app utiliza apenas os recursos estritamente necessários ao seu funcionamento. Não utilizamos cookies de publicidade.",
          },
        ],
      },
      {
        id: "alteracoes",
        heading: "14. Alterações nesta Política",
        blocks: [
          {
            type: "p",
            text: "Podemos atualizar esta Política periodicamente. Quando houver mudanças relevantes, atualizaremos a data de vigência e, quando exigido, solicitaremos seu consentimento. A versão vigente está sempre disponível em athlyproject.app/privacy.",
          },
        ],
      },
    ],
  },
  en: {
    badge: "Privacy",
    title: "Privacy Policy",
    subtitle:
      "How Athly collects, uses, shares, and protects your personal data in the Athly Runner app and on athlyproject.app.",
    lastUpdated: LAST_UPDATED_EN,
    sections: [
      {
        id: "controller",
        heading: "1. Who controls your data",
        blocks: [
          {
            type: "p",
            text: "The Athly Runner app and the athlyproject.app website are operated by:",
          },
          {
            type: "list",
            items: [
              `Legal entity: ${companyInfo.legalEntityName}`,
              `${companyInfo.registrationLabel}: ${companyInfo.registrationNumber}`,
              `Address: ${companyInfo.registeredAddress} — ${companyInfo.country}`,
              `Contact and Data Protection Officer (DPO): ${companyInfo.legalEmail}`,
            ],
          },
          {
            type: "p",
            text: "For any privacy question or to exercise your rights, write to our contact below.",
          },
          { type: "link", label: companyInfo.legalEmail, href: `mailto:${companyInfo.legalEmail}` },
        ],
      },
      {
        id: "data-collected",
        heading: "2. Data we collect",
        blocks: [
          {
            type: "p",
            text: "We only collect the data needed to offer a personalized training plan and track your progress:",
          },
          {
            type: "list",
            items: [
              "Account and identity data: name, email, username, date of birth, and password.",
              "Physical data: weight and height, used to estimate calories and personalize your training.",
              "Health and activity data (Apple Health / HealthKit): running workouts, heart rate (average, maximum, and per segment), distance, active energy, and workout routes. With your permission, Athly also writes your runs back to the Health app.",
              "Precise location data (GPS): during an active run, we record your route in real time (latitude, longitude, altitude, speed, accuracy, and timestamp), including in the background with the screen locked.",
              "Workout performance data: pace, per-kilometer splits, segments, elevation gain, calories, sport type, and intensity.",
              "Fitness assessment questionnaire (PAR-Q) answers: activity history, available training days, best times, sleep quality, and physical-readiness information such as chronic pain. This is sensitive personal health data.",
              "Goals: the free text you write to describe your objectives.",
              "Workout feedback: effort level, fatigue, and whether the workout was completed.",
              "Subscription data: subscription status and identifiers provided by Apple and RevenueCat. We do not have access to your card number.",
              "Technical and diagnostic data: crash information, usage logs, and session identifiers, used to keep the app stable and secure.",
            ],
          },
        ],
      },
      {
        id: "purposes",
        heading: "3. How and why we use your data",
        blocks: [
          { type: "p", text: "We use your data to:" },
          {
            type: "list",
            items: [
              "Create and adjust your personalized training plan, including with artificial intelligence.",
              "Record, display, and analyze your runs and progress.",
              "Manage your account, authentication, and subscription.",
              "Send transactional communications (for example, account confirmation and workout reminders).",
              "Ensure security, prevent fraud, and fix errors.",
            ],
          },
          {
            type: "p",
            text: "Legal bases (LGPD and GDPR): performance of the contract (providing the service); consent, especially for health data, location, HealthKit integration, and notifications; compliance with legal obligations; and legitimate interest for security and service improvement. You may withdraw your consent at any time.",
          },
        ],
      },
      {
        id: "ai",
        heading: "4. Artificial intelligence (Google Gemini)",
        blocks: [
          {
            type: "p",
            text: "Athly uses artificial intelligence to generate and adjust your training plan. To do so, we send the necessary data — such as your profile, run history, relevant health metrics, questionnaire answers, and goals — to an AI provider, Google Gemini (model gemini-2.5-flash).",
          },
          {
            type: "p",
            text: "This data is processed only to generate your training recommendations. We do not use artificial intelligence for advertising. Google's processing follows the Google API data usage terms. If you do not agree with this processing, automatic plans cannot be generated.",
          },
        ],
      },
      {
        id: "sharing",
        heading: "5. Sharing and processors",
        blocks: [
          {
            type: "p",
            text: "We do not sell your personal data and do not use it for targeted advertising or cross-app tracking. We share data only with processors that help us provide the service:",
          },
          {
            type: "list",
            items: [
              "Google (Gemini): AI-based generation of your training plan.",
              "RevenueCat and Apple: processing of subscriptions and purchases.",
              "Apple Health (HealthKit): reading and writing health data on your device, with your permission.",
              "Amazon Web Services (AWS): infrastructure hosting and transactional email delivery (AWS SES).",
            ],
          },
          {
            type: "p",
            text: "Planned or optional features: in the future, we may offer stability monitoring (Sentry) and optional connections to third-party services such as Strava and Garmin. These connections only occur if and when you expressly authorize them, and we will update this Policy before enabling them.",
          },
          {
            type: "p",
            text: "We may also disclose data when required by law or court order.",
          },
        ],
      },
      {
        id: "healthkit",
        heading: "6. Apple Health (HealthKit)",
        blocks: [
          {
            type: "p",
            text: "Data obtained from Apple Health (HealthKit) is used exclusively to record, display, and analyze your workouts within Athly. We do not use HealthKit data for advertising or marketing, and we do not sell or disclose it to third parties for those purposes. You can revoke access at any time in Settings > Health > Data Access & Devices.",
          },
        ],
      },
      {
        id: "location",
        heading: "7. Background location",
        blocks: [
          {
            type: "p",
            text: "We collect your precise location only during an active run, to map your route — including in the background with the screen locked, while showing the iOS location indicator. We do not track your location outside of a run. You can disable access in Settings > Privacy & Security > Location Services.",
          },
        ],
      },
      {
        id: "transfer",
        heading: "8. International data transfers",
        blocks: [
          {
            type: "p",
            text: "Some processors (such as Google and AWS) process data on servers outside Brazil, including in the United States. We adopt appropriate safeguards for these transfers, in accordance with the LGPD (art. 33) and the GDPR (standard contractual clauses).",
          },
        ],
      },
      {
        id: "security",
        heading: "9. Storage, security, and retention",
        blocks: [
          {
            type: "p",
            text: "We protect your data with in-transit encryption (HTTPS), secure credential storage in the iOS Keychain, and passwords protected by hashing on the server. We keep your data while your account is active. When you delete your account, we remove your associated personal data, subject to any legal retention obligations.",
          },
        ],
      },
      {
        id: "rights",
        heading: "10. Your rights",
        blocks: [
          {
            type: "p",
            text: "Under the LGPD and GDPR, you have the right to access, correct, delete, port, and obtain information about your data, as well as to withdraw consent. To exercise them:",
          },
          {
            type: "list",
            items: [
              `Write to ${companyInfo.legalEmail}.`,
              "Delete your account and all data directly in the app, under Profile > Delete account.",
              "Revoke Health, Location, and Notification permissions in iOS Settings.",
            ],
          },
        ],
      },
      {
        id: "notifications",
        heading: "11. Notifications",
        blocks: [
          {
            type: "p",
            text: "We send workout reminders through local notifications. You can disable them at any time in the app preferences or in iOS Settings.",
          },
        ],
      },
      {
        id: "age",
        heading: "12. Minimum age",
        blocks: [
          {
            type: "p",
            text: "Athly is not intended for children under 13, and we do not knowingly collect their data. If you are a guardian and believe a child has provided us with data, please contact us so we can remove it.",
          },
        ],
      },
      {
        id: "cookies",
        heading: "13. Cookies and the website",
        blocks: [
          {
            type: "p",
            text: "The athlyproject.app website uses only the resources strictly necessary for it to function. We do not use advertising cookies.",
          },
        ],
      },
      {
        id: "changes",
        heading: "14. Changes to this Policy",
        blocks: [
          {
            type: "p",
            text: "We may update this Policy from time to time. When there are material changes, we will update the effective date and, where required, request your consent. The current version is always available at athlyproject.app/privacy.",
          },
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export const supportDoc: Record<Lang, LegalDoc> = {
  pt: {
    badge: "Central de ajuda",
    title: "Suporte",
    subtitle: "Precisa de ajuda com o Athly Runner? Estamos aqui para você.",
    sections: [
      {
        id: "contato",
        heading: "Fale com o suporte",
        blocks: [
          {
            type: "p",
            text: "Encontrou um problema, tem uma dúvida ou quer enviar uma sugestão? Fale diretamente com a nossa equipe. Normalmente respondemos em até 2 dias úteis.",
          },
          { type: "link", label: companyInfo.supportEmail, href: `mailto:${companyInfo.supportEmail}` },
        ],
      },
      {
        id: "conta",
        heading: "Gerenciar ou excluir sua conta",
        blocks: [
          {
            type: "p",
            text: "Você pode excluir sua conta e todos os seus dados diretamente no app: abra Perfil > Excluir conta. A exclusão é permanente e remove seu plano, treinos e histórico.",
          },
        ],
      },
      {
        id: "privacidade",
        heading: "Privacidade",
        blocks: [
          {
            type: "p",
            text: "Saiba como tratamos seus dados na nossa Política de Privacidade.",
          },
          { type: "link", label: "Política de Privacidade", href: "/privacy" },
        ],
      },
      {
        id: "site",
        heading: "Site oficial",
        blocks: [{ type: "link", label: companyInfo.websiteUrl, href: companyInfo.websiteUrl }],
      },
    ],
  },
  en: {
    badge: "Help center",
    title: "Support",
    subtitle: "Need help with Athly Runner? We're here for you.",
    sections: [
      {
        id: "contact",
        heading: "Contact support",
        blocks: [
          {
            type: "p",
            text: "Found a problem, have a question, or want to send feedback? Reach out to our team directly. We usually reply within 2 business days.",
          },
          { type: "link", label: companyInfo.supportEmail, href: `mailto:${companyInfo.supportEmail}` },
        ],
      },
      {
        id: "account",
        heading: "Manage or delete your account",
        blocks: [
          {
            type: "p",
            text: "You can delete your account and all your data directly in the app: open Profile > Delete account. Deletion is permanent and removes your plan, workouts, and history.",
          },
        ],
      },
      {
        id: "privacy",
        heading: "Privacy",
        blocks: [
          {
            type: "p",
            text: "Learn how we handle your data in our Privacy Policy.",
          },
          { type: "link", label: "Privacy Policy", href: "/privacy" },
        ],
      },
      {
        id: "website",
        heading: "Official website",
        blocks: [{ type: "link", label: companyInfo.websiteUrl, href: companyInfo.websiteUrl }],
      },
    ],
  },
};
