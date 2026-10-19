import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { IMailer, MailerConfig, SendOptions } from '../types';

/**
 * AWS SES sender for production. Construction is lazy at first send so we
 * don't pull SDK initialization onto app startup hot path.
 */
export class SesMailer implements IMailer {
  private client: SESClient | null = null;

  constructor(private readonly config: MailerConfig) {}

  private getClient(): SESClient {
    if (!this.client) {
      this.client = new SESClient({ region: this.config.awsRegion ?? 'us-east-1' });
    }
    return this.client;
  }

  async send(options: SendOptions): Promise<void> {
    const cmd = new SendEmailCommand({
      Source: options.from ?? this.config.defaultFrom,
      Destination: { ToAddresses: [options.to] },
      Message: {
        Subject: { Data: options.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: options.html, Charset: 'UTF-8' },
          ...(options.text && { Text: { Data: options.text, Charset: 'UTF-8' } }),
        },
      },
    });
    await this.getClient().send(cmd);
  }
}
