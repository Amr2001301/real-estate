-- AlterTable
ALTER TABLE "VisitAppointment" ADD COLUMN     "dayBeforeReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "hourBeforeReminderSentAt" TIMESTAMP(3);
