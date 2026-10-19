// ─── Mailer Types ───────────────────────────────────────────────────────────

export interface MailerConfig {
  /** Provider name. `ses` (prod) | `mailtrap` (dev SMTP) | `console` (fallback). */
  provider: 'ses' | 'mailtrap' | 'console';
  /** Default From: address when the caller doesn't override. */
  defaultFrom: string;
  /** SES — AWS region (defaults to us-east-1). */
  awsRegion?: string;
  /** Mailtrap — host/port/user/pass (read from env in main.ts). */
  mailtrap?: { host: string; port: number; user: string; pass: string };
}

export interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Override the configured `defaultFrom` for this send. */
  from?: string;
}

export interface IMailer {
  send(options: SendOptions): Promise<void>;
}

/** Ergonomic helper alias for code that's narrowing on the public API. */
export type MailerSend = IMailer['send'];
