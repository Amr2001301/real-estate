import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FirebaseService } from '../../common/firebase/firebase.service';

const UNREGISTERED_ERRORS = new Set<string>([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export interface PushResult {
  enabled: boolean;
  sent: number;
  failed: number;
  pruned: number;
}

/**
 * Sends FCM pushes to a user's registered devices. No-op (but logged) when
 * Firebase isn't configured, so notification creation never fails on push.
 * Prunes device tokens the FCM backend reports as unregistered/invalid.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  /** Whether Firebase credentials are present and the Admin SDK initialised. */
  get pushEnabled(): boolean {
    return this.firebase.enabled;
  }

  async sendToUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<PushResult> {
    const messaging = this.firebase.messaging();
    if (messaging === null) {
      this.logger.debug(`Push skipped (FCM disabled) for user ${userId}`);
      return { enabled: false, sent: 0, failed: 0, pruned: 0 };
    }

    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (devices.length === 0) {
      return { enabled: true, sent: 0, failed: 0, pruned: 0 };
    }

    const tokens = devices.map((d) => d.token);
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      // Ensure foreground (flutter_local_notifications) and background
      // (system tray) notifications use the same Android channel so
      // importance / sound settings are consistent.
      android: { notification: { channelId: 'devora_push' } },
    });

    // Collect tokens the FCM backend says are dead, and prune them.
    const stale: string[] = [];
    response.responses.forEach((res, i) => {
      const token = tokens[i];
      if (!res.success && token && UNREGISTERED_ERRORS.has(res.error?.code ?? '')) {
        stale.push(token);
      }
    });
    if (stale.length > 0) {
      await this.prisma.deviceToken.deleteMany({ where: { token: { in: stale } } });
    }

    return {
      enabled: true,
      sent: response.successCount,
      failed: response.failureCount,
      pruned: stale.length,
    };
  }
}
