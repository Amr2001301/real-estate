-- FU2: the follow-up time a reminder / an overdue alert was last sent for.
ALTER TABLE "Lead" ADD COLUMN "followUpRemindedFor" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "followUpOverdueFor" TIMESTAMP(3);
