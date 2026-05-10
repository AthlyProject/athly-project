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

  async sendOtpEmail(to: string, userName: string, otpCode: string): Promise<void> {
    const subject = 'Confirme seu e-mail no Athly! 🏃‍♂️';
    const htmlBody = this.buildOtpHtml(userName, otpCode);
    const textBody = this.buildOtpText(userName, otpCode);

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
      this.logger.log(`OTP confirmation email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send OTP email to ${to}: ${(error as Error).message}`,
      );
      // Don't throw — email failure should not block registration
    }
  }

  private buildOtpHtml(userName: string, otpCode: string): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu e-mail no Athly</title>
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
                Falta pouco para você aproveitar tudo do <strong>Athly</strong>! Use o código abaixo para confirmar seu e-mail.
              </p>
              <div style="background-color: #f0f0ff; border: 2px dashed #6366f1; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
                <p style="margin: 0; color: #18181b; font-size: 32px; font-weight: 700; letter-spacing: 4px;">
                  ${otpCode}
                </p>
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

  private buildOtpText(userName: string, otpCode: string): string {
    return [
      `Olá, ${userName}!`,
      '',
      'Falta pouco para você aproveitar tudo do Athly! Use o código abaixo para confirmar seu e-mail:',
      '',
      `Código de Confirmação: ${otpCode}`,
      '',
      'Se você não criou esta conta, por favor ignore este e-mail.',
      '',
      `© ${new Date().getFullYear()} Athly. Todos os direitos reservados.`,
    ].join('\n');
  }
}
