import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

@Injectable()
export class EmailService {
  private readonly ses: SESClient;
  private readonly senderEmail: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {
    this.ses = new SESClient({
      region: this.config.get<string>('AWS_REGION', 'eu-central-1'),
    });
    this.senderEmail = this.config.get<string>(
      'SES_SENDER_EMAIL',
      'noreply@athlyproject.app',
    );
  }

  async sendWelcomeEmail(to: string, userName: string): Promise<void> {
    const subject = 'Bem-vindo ao Athly! 🏃‍♂️';
    const htmlBody = this.buildWelcomeHtml(userName);
    const textBody = this.buildWelcomeText(userName);

    try {
      const command = new SendEmailCommand({
        Source: `Athly <${this.senderEmail}>`,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: htmlBody, Charset: 'UTF-8' },
            Text: { Data: textBody, Charset: 'UTF-8' },
          },
        },
      });

      await this.ses.send(command);
      this.logger.log(`Welcome email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${to}: ${(error as Error).message}`,
      );
      // Don't throw — email failure should not block registration
    }
  }

  private buildWelcomeHtml(userName: string): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao Athly</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                Athly
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
                Seu parceiro de treino inteligente
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #18181b; font-size: 22px; font-weight: 600;">
                Olá, ${userName}! 👋
              </h2>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Sua conta no <strong>Athly</strong> foi criada com sucesso! Estamos muito felizes em ter você conosco.
              </p>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Agora você pode começar a usar a plataforma para planejar seus treinos, acompanhar seu progresso e alcançar seus objetivos.
              </p>
              <div style="background-color: #f0f0ff; border-left: 4px solid #6366f1; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 12px; color: #18181b; font-size: 15px; font-weight: 600;">
                  🚀 Próximos passos:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #3f3f46; font-size: 14px; line-height: 1.8;">
                  <li>Complete seu questionário de avaliação</li>
                  <li>Conecte o Apple Health para análise dos seus treinos</li>
                  <li>Receba seu plano de treino personalizado com IA</li>
                </ul>
              </div>
              <p style="margin: 24px 0 0; color: #71717a; font-size: 14px; line-height: 1.6;">
                Se você não criou esta conta, por favor ignore este e-mail.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                © ${new Date().getFullYear()} Athly. Todos os direitos reservados.
              </p>
              <p style="margin: 8px 0 0; color: #a1a1aa; font-size: 12px;">
                Este é um e-mail automático, por favor não responda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
  }

  private buildWelcomeText(userName: string): string {
    return [
      `Olá, ${userName}!`,
      '',
      'Bem-vindo ao Athly! Sua conta foi criada com sucesso.',
      '',
      'Agora você pode começar a usar a plataforma para planejar seus treinos, acompanhar seu progresso e alcançar seus objetivos.',
      '',
      'Próximos passos:',
      '- Complete seu questionário de avaliação',
      '- Conecte o Apple Health para análise dos seus treinos',
      '- Receba seu plano de treino personalizado com IA',
      '',
      'Se você não criou esta conta, por favor ignore este e-mail.',
      '',
      `© ${new Date().getFullYear()} Athly. Todos os direitos reservados.`,
    ].join('\n');
  }
}
