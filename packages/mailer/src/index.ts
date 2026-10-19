import type { IMailer, MailerConfig, SendOptions } from './types';
import { ConsoleMailer } from './providers/console.provider';
import { SesMailer } from './providers/ses.provider';
import { MailtrapMailer } from './providers/mailtrap.provider';
import { templates } from './templates';

export type { MailerConfig, SendOptions } from './types';
export { templates };

// ─── Singleton + lazy init (matches @hs/cache pattern) ──────────────────────

class MailerService implements IMailer {
  private impl: IMailer | null = null;
  private config: MailerConfig | null = null;

  init(config: MailerConfig): void {
    this.config = config;
    switch (config.provider) {
      case 'ses':
        this.impl = new SesMailer(config);
        break;
      case 'mailtrap':
        this.impl = new MailtrapMailer(config);
        break;
      case 'console':
      default:
        this.impl = new ConsoleMailer();
        break;
    }
  }

  private ensure(): IMailer {
    if (!this.impl) {
      // Auto-init to console-fallback so callers never get a hard crash if
      // mailer.init() was forgotten in main.ts. Logged loudly so it's caught.
      // Direct stderr write — same reason as ConsoleMailer (no observability dep).
      process.stderr.write('[mailer] auto-initializing to console provider — call mailer.init() in main.ts\n');
      this.init({ provider: 'console', defaultFrom: 'no-reply@example.com' });
    }
    return this.impl!;
  }

  /**
   * Send a raw email. Use the convenience wrappers below instead when one
   * of the predefined templates fits — they keep `to`, `subject`, `html`,
   * `text` consistent with our content style.
   */
  async send(options: SendOptions): Promise<void> {
    return this.ensure().send(options);
  }

  // ─── Convenience template-bound wrappers ──────────────────────────────

  async sendOtp(to: string, args: { code: string; expiresInMinutes: number }): Promise<void> {
    const t = templates.otp(args);
    return this.send({ to, ...t });
  }

  async sendInvite(
    to: string,
    args: { invitedByName: string; orgName: string; appNames: string[]; signInUrl: string },
  ): Promise<void> {
    const t = templates.invite(args);
    return this.send({ to, ...t });
  }

  async sendAccessPending(
    to: string,
    args: {
      requesterEmail: string;
      requesterName?: string;
      appName: string;
      ehrName?: string;
      reviewUrl: string;
    },
  ): Promise<void> {
    const t = templates.accessPending(args);
    return this.send({ to, ...t });
  }
}

export const mailer = new MailerService();
