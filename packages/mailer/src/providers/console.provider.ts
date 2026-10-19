import type { IMailer, SendOptions } from '../types';

/**
 * Fallback that writes the email to stdout. Used when no real provider is
 * configured (local dev without Mailtrap, CI). Never throws — even a broken
 * mailer must not block the request lane.
 *
 * We write directly to process.stdout instead of going through @hs/logger
 * to keep this package dep-free from observability (avoids cycles).
 */
export class ConsoleMailer implements IMailer {
  async send(options: SendOptions): Promise<void> {
    const head = `[mailer:console] → ${JSON.stringify({ to: options.to, subject: options.subject })}\n`;
    const body = `${options.text ?? options.html}\n`;
    process.stdout.write(head);
    process.stdout.write(body);
  }
}
