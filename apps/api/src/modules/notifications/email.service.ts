import { Injectable, Logger } from "@nestjs/common";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Minimal email abstraction (spec section 57: notifications must support
 * in-app + email today, with room for SMS/WhatsApp/Slack/Teams later).
 * Without SMTP_HOST configured, messages are logged rather than silently
 * dropped or faked as "sent" — this keeps local dev and demo mode honest.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly smtpConfigured = Boolean(process.env.SMTP_HOST);

  async send(message: EmailMessage): Promise<void> {
    if (!this.smtpConfigured) {
      this.logger.warn(
        `[DEV EMAIL — SMTP not configured, not actually sent] To: ${message.to} | Subject: ${message.subject}\n${message.text}`,
      );
      return;
    }

    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? "no-reply@event-intel.local",
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}
