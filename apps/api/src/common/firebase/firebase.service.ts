import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { app, messaging } from 'firebase-admin';

/**
 * Initializes the Firebase Admin SDK from env credentials. When credentials are
 * absent (dev/test, or prod-not-yet-configured) it stays **disabled** and is a
 * safe no-op — callers check {@link enabled}. firebase-admin is imported lazily
 * so the dependency is only loaded when actually configured.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private _app: app.App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKeyRaw = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKeyRaw) {
      this.logger.warn('FCM disabled — Firebase credentials not configured');
      return;
    }

    try {
      // Lazy require keeps firebase-admin out of the graph until configured.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const admin = require('firebase-admin') as typeof import('firebase-admin');
      // Env files store the key with literal "\n"; restore real newlines.
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
      this._app = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
      this.logger.log(`FCM enabled for project ${projectId}`);
    } catch (err) {
      // Never crash the app over push setup; log without leaking the key.
      this.logger.error(`FCM init failed: ${(err as Error).message}`);
      this._app = null;
    }
  }

  get enabled(): boolean {
    return this._app !== null;
  }

  messaging(): messaging.Messaging | null {
    return this._app ? this._app.messaging() : null;
  }
}
