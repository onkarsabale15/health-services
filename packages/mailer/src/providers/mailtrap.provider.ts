import type { IMailer, MailerConfig, SendOptions } from '../types';

/**
 * Mailtrap sandbox sender for local dev — uses Mailtrap's HTTP API directly
 * so we don't pull nodemailer/SMTP client into the dependency graph.
 *
 * Configure via env:
 *   MAILTRAP_API_TOKEN  — required
 *   MAILTRAP_INBOX_ID   — required (Sandbox API path includes the inbox id)
 *
 * Sandbox URL: https://sandbox.api.mailtrap.io/api/send/{inboxId}
 */
export class MailtrapMailer implements IMailer {
  private readonly endpoint: string;
  private readonly token: string;

  constructor(private readonly config: MailerConfig) {
    const inboxId = process.env.MAILTRAP_INBOX_ID;
    const token = process.env.MAILTRAP_API_TOKEN;
    if (!inboxId || !token) {
      throw new Error('MAILTRAP_INBOX_ID and MAILTRAP_API_TOKEN must be set when provider=mailtrap');
    }
    this.endpoint = `https://sandbox.api.mailtrap.io/api/send/${inboxId}`;
    this.token = token;
  }

  async send(options: SendOptions): Promise<void> {
    const body = {
      from: { email: options.from ?? this.config.defaultFrom },
      to: [{ email: options.to }],
      subject: options.subject,
      html: options.html,
      ...(options.text && { text: options.text }),
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Mailtrap send failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
    }
  }
}
