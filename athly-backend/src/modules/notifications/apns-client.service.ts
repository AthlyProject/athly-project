import { Injectable } from '@nestjs/common';
import { createPrivateKey, sign } from 'node:crypto';
import { connect } from 'node:http2';
import { PushEnvironment } from '@prisma/client';

export type ApnsSendResult = {
  statusCode: number;
  reason?: string;
};

@Injectable()
export class ApnsClientService {
  private cachedJwt?: { value: string; expiresAt: number };

  get isConfigured(): boolean {
    return Boolean(
      process.env.APNS_KEY_ID &&
        process.env.APNS_TEAM_ID &&
        process.env.APNS_PRIVATE_KEY &&
        process.env.APNS_TOPIC,
    );
  }

  async send(
    token: string,
    environment: PushEnvironment,
    payload: Record<string, unknown>,
    collapseId: string,
  ): Promise<ApnsSendResult> {
    if (!this.isConfigured) throw new Error('APNs não configurado');
    const authority =
      environment === PushEnvironment.SANDBOX
        ? 'https://api.sandbox.push.apple.com'
        : 'https://api.push.apple.com';

    return new Promise<ApnsSendResult>((resolve, reject) => {
      const client = connect(authority);
      let settled = false;
      const finish = (error?: Error, result?: ApnsSendResult) => {
        if (settled) return;
        settled = true;
        client.close();
        if (error) reject(error);
        else resolve(result!);
      };
      client.once('error', (error) => finish(error));

      const request = client.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${this.providerToken()}`,
        'apns-topic': process.env.APNS_TOPIC!,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-collapse-id': collapseId.slice(0, 64),
      });
      let statusCode = 0;
      let body = '';
      request.setEncoding('utf8');
      request.setTimeout(15_000, () => request.destroy(new Error('Timeout ao chamar APNs')));
      request.on('response', (headers) => {
        statusCode = Number(headers[':status'] ?? 0);
      });
      request.on('data', (chunk: string) => {
        body += chunk;
      });
      request.once('error', (error) => finish(error));
      request.once('end', () => {
        let reason: string | undefined;
        if (body) {
          try {
            reason = (JSON.parse(body) as { reason?: string }).reason;
          } catch {
            reason = body;
          }
        }
        finish(undefined, { statusCode, reason });
      });
      request.end(JSON.stringify(payload));
    });
  }

  private providerToken(): string {
    if (this.cachedJwt && this.cachedJwt.expiresAt > Date.now()) return this.cachedJwt.value;
    const header = this.base64Url({ alg: 'ES256', kid: process.env.APNS_KEY_ID! });
    const claims = this.base64Url({
      iss: process.env.APNS_TEAM_ID!,
      iat: Math.floor(Date.now() / 1000),
    });
    const unsigned = `${header}.${claims}`;
    const key = createPrivateKey(process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, '\n'));
    const signature = sign('sha256', Buffer.from(unsigned), {
      key,
      dsaEncoding: 'ieee-p1363',
    }).toString('base64url');
    const value = `${unsigned}.${signature}`;
    this.cachedJwt = { value, expiresAt: Date.now() + 50 * 60 * 1000 };
    return value;
  }

  private base64Url(value: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }
}
