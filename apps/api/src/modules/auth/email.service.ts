import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  /** Send a password-reset email. The raw token is embedded in the link only. */
  async sendPasswordReset(to: string, rawToken: string): Promise<void> {
    const webUrl = this.config.get<string>('PUBLIC_WEB_URL') ?? 'http://localhost:3001';
    const resetUrl = `${webUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    const from = this.config.get<string>('SMTP_FROM') ?? 'noreply@devora.sa';
    const subject = 'إعادة تعيين كلمة المرور — ديفورا';
    const text = [
      'لقد تلقينا طلبًا لإعادة تعيين كلمة المرور لحسابك.',
      '',
      'انقر على الرابط التالي لإعادة تعيين كلمة المرور:',
      resetUrl,
      '',
      'ينتهي هذا الرابط خلال 20 دقيقة وهو صالح للاستخدام مرة واحدة فقط.',
      '',
      'إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد بأمان.',
    ].join('\n');

    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; color: #1a1a2e;">
        <h2 style="margin: 0 0 16px; color: #0F1E33;">إعادة تعيين كلمة المرور</h2>
        <p style="margin: 0 0 12px; line-height: 1.7;">لقد تلقينا طلبًا لإعادة تعيين كلمة المرور لحسابك في ديفورا.</p>
        <p style="margin: 0 0 24px; line-height: 1.7;">انقر على الزر أدناه لإعادة تعيين كلمة المرور:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 28px; background: #0F1E33; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">إعادة تعيين كلمة المرور</a>
        <p style="margin: 24px 0 8px; font-size: 13px; color: #666;">ينتهي هذا الرابط خلال <strong>20 دقيقة</strong> وهو صالح للاستخدام <strong>مرة واحدة</strong> فقط.</p>
        <p style="margin: 0; font-size: 13px; color: #666;">إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد بأمان.</p>
        <hr style="margin: 28px 0; border: none; border-top: 1px solid #eee;" />
        <p style="margin: 0; font-size: 12px; color: #999;">© ديفورا — منصة الإدارة العقارية</p>
      </div>
    `;

    const transporter = this.createTransporter();
    if (!transporter) {
      // No SMTP configured (dev/test) — log the link locally instead.
      this.logResetLinkForDev(to, resetUrl);
      return;
    }

    try {
      await transporter.sendMail({ from, to, subject, text, html });
    } catch (err) {
      this.logger.error(`Failed to send password-reset email to ${to}: ${(err as Error).message}`);
    }
  }

  /** Send an email-verification link. Raw token is embedded in the link only. */
  async sendEmailVerification(to: string, rawToken: string): Promise<void> {
    const webUrl = this.config.get<string>('PUBLIC_WEB_URL') ?? 'http://localhost:3002';
    const verifyUrl = `${webUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;

    const from = this.config.get<string>('SMTP_FROM') ?? 'noreply@devora.sa';
    const subject = 'تأكيد البريد الإلكتروني — ديفورا';
    const text = [
      'شكرًا لتسجيلك في ديفورا!',
      '',
      'انقر على الرابط التالي لتأكيد بريدك الإلكتروني:',
      verifyUrl,
      '',
      'ينتهي هذا الرابط خلال 60 دقيقة وهو صالح للاستخدام مرة واحدة فقط.',
      '',
      'إذا لم تُنشئ حسابًا في ديفورا، يمكنك تجاهل هذا البريد بأمان.',
    ].join('\n');

    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; color: #1a1a2e;">
        <h2 style="margin: 0 0 16px; color: #0F1E33;">تأكيد البريد الإلكتروني</h2>
        <p style="margin: 0 0 12px; line-height: 1.7;">شكرًا لتسجيلك في ديفورا! انقر على الزر أدناه لتأكيد بريدك الإلكتروني.</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 28px; background: #0F1E33; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">تأكيد البريد الإلكتروني</a>
        <p style="margin: 24px 0 8px; font-size: 13px; color: #666;">ينتهي هذا الرابط خلال <strong>60 دقيقة</strong> وهو صالح للاستخدام <strong>مرة واحدة</strong> فقط.</p>
        <p style="margin: 0; font-size: 13px; color: #666;">إذا لم تُنشئ حسابًا في ديفورا، يمكنك تجاهل هذا البريد بأمان.</p>
        <hr style="margin: 28px 0; border: none; border-top: 1px solid #eee;" />
        <p style="margin: 0; font-size: 12px; color: #999;">© ديفورا — منصة الإدارة العقارية</p>
      </div>
    `;

    const transporter = this.createTransporter();
    if (!transporter) {
      this.logVerifyLinkForDev(to, verifyUrl);
      return;
    }

    try {
      await transporter.sendMail({ from, to, subject, text, html });
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${to}: ${(err as Error).message}`);
    }
  }

  /**
   * Generic transactional email for domain events (reservation, contract,
   * deposit, maintenance). Subject and HTML body are resolved by the caller
   * from the notification template.
   *
   * Returns a discriminated union so the caller can record the outcome on the
   * Notification row without catching exceptions themselves:
   *   { ok: true,  sentAt: Date }   — SMTP accepted the message
   *   { ok: false, error: string }  — SMTP unconfigured or provider rejected
   */
  async sendNotificationEmail(
    to: string,
    subject: string,
    htmlBody: string,
  ): Promise<{ ok: true; sentAt: Date } | { ok: false; error: string }> {
    const from = this.config.get<string>('SMTP_FROM') ?? 'noreply@devora.sa';
    const transporter = this.createTransporter();
    if (!transporter) {
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(`[email] notification email to ${to} — ${subject}`);
      }
      return { ok: false, error: 'SMTP not configured' };
    }
    try {
      const text = htmlBody.replace(/<[^>]+>/g, '');
      await transporter.sendMail({ from, to, subject, text, html: htmlBody });
      return { ok: true, sentAt: new Date() };
    } catch (err) {
      const msg = ((err as Error).message ?? 'unknown SMTP error').slice(0, 500);
      this.logger.error(`Failed to send notification email to ${to}: ${msg}`);
      return { ok: false, error: msg };
    }
  }

  private createTransporter(): Transporter | null {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    if (!host || !user || !pass) return null;

    const port = this.config.get<number>('SMTP_PORT') ?? 587;
    return nodemailer.createTransport({ host, port, auth: { user, pass } });
  }

  private logResetLinkForDev(to: string, resetUrl: string): void {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      this.logger.warn(`[email] password-reset email attempted for ${to} but SMTP not configured`);
      return;
    }
    this.logger.warn(`[email] password-reset link for ${to} → ${resetUrl}`);
  }

  private logVerifyLinkForDev(to: string, verifyUrl: string): void {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      this.logger.warn(`[email] verification email attempted for ${to} but SMTP not configured`);
      return;
    }
    this.logger.warn(`[email] email-verification link for ${to} → ${verifyUrl}`);
  }
}
