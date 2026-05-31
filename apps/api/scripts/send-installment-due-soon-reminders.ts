/**
 * Manual runner for the P11.7 installment due-soon reminders — for local
 * testing and ad-hoc operational sends. Reuses the SAME
 * InstallmentRemindersService the cron uses, so behavior (window, dedupe, safe
 * payload, best-effort send) is identical.
 *
 * Behaviour:
 *   - Dry-run by DEFAULT; pass --execute to actually send.
 *   - Idempotent: never re-sends a reminder already sent for the same
 *     installment + dueDate (dedupe is in the service), so repeated --execute
 *     runs on the same day send nothing new.
 *   - Works WITHOUT Firebase: FCM stays disabled here (the Firebase init hook
 *     is never run), so push is a no-op while DB notifications are still
 *     created.
 *   - Prints aggregate counts only — never amounts, names, or contacts.
 *   - Independent of INSTALLMENT_REMINDERS_ENABLED (that flag only gates the
 *     automatic cron; this command is an explicit operator action).
 *
 * Implementation note: hand-constructs the service chain with a direct
 * PrismaClient (like the other data scripts) rather than booting a Nest
 * context, avoiding the auth/Firebase module-init DI chain entirely.
 *
 * Run with:
 *   npx tsx scripts/send-installment-due-soon-reminders.ts            (dry-run)
 *   npx tsx scripts/send-installment-due-soon-reminders.ts --execute  (sends)
 *
 * or via package scripts:
 *   pnpm --filter api reminders:installments:due-soon:dry-run
 *   pnpm --filter api reminders:installments:due-soon            (sends)
 */
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

import type { PrismaService } from '../src/common/prisma/prisma.service';
import { FirebaseService } from '../src/common/firebase/firebase.service';
import { NotificationsService } from '../src/modules/notifications/notifications.module';
import { PushService } from '../src/modules/notifications/push.service';
import { InstallmentRemindersService } from '../src/modules/installments/installments.module';

const EXECUTE = process.argv.includes('--execute');

async function main(): Promise<void> {
  console.log(
    EXECUTE
      ? '⚠️  EXECUTE mode — due-soon reminders will be sent.'
      : 'ℹ️  DRY-RUN — no notifications will be created. Pass --execute to send.',
  );
  console.log('');

  const prisma = new PrismaClient();
  const config = new ConfigService(process.env);
  // FCM disabled (onModuleInit not invoked) → push no-ops; DB notifications
  // are still written by NotificationsService.send().
  const firebase = new FirebaseService(config);
  const notifications = new NotificationsService(
    prisma as unknown as PrismaService,
    new PushService(prisma as unknown as PrismaService, firebase),
  );
  const svc = new InstallmentRemindersService(prisma as unknown as PrismaService, notifications, config);

  try {
    const s = await svc.run({ dryRun: !EXECUTE });
    console.log('');
    console.log(
      `Scanned ${s.scanned} due-soon installment(s). ` +
        `${EXECUTE ? 'Sent' : 'Would send'} ${s.sent} · skipped ${s.skipped} · failed ${s.failed}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
