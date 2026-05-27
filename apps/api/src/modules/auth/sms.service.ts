import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const provider = this.config.get<string>('OTP_PROVIDER') ?? 'console';
    if (provider === 'console') {
      this.logOtpForDev(phone, code);
      return;
    }
    if (provider === 'twilio') {
      // Lazy require to keep optional
      const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
      const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
      const from = this.config.get<string>('TWILIO_FROM');
      if (!sid || !token || !from) {
        this.logger.error('Twilio creds missing — cannot send OTP');
        this.logOtpForDev(phone, code);
        return;
      }
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const body = new URLSearchParams({
        To: phone,
        From: from,
        Body: `Your verification code is ${code}`,
      });
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Twilio send failed: ${res.status} ${text}`);
      }
    }
  }

  // Logs the OTP code only outside production so it never leaks in prod logs.
  private logOtpForDev(phone: string, code: string): void {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      this.logger.warn(`[OTP] code generated for ${phone} (hidden in production)`);
      return;
    }
    this.logger.warn(`[OTP] -> ${phone}: ${code}`);
  }
}
