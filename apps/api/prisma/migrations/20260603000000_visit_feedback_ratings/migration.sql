-- Gap 7 — post-visit feedback/ratings on VisitAppointment.
--
-- Six additive nullable columns. customer* is customer-submitted (one-time,
-- after COMPLETED); sales* is staff-submitted. Ratings are 1–5. The legacy
-- free-text columns (salesNotes / customerFeedback / resultNotes) are left
-- untouched — customerFeedback still doubles as the reschedule reason — so this
-- migration adds dedicated, unambiguous fields and changes no existing data.

ALTER TABLE "VisitAppointment"
  ADD COLUMN "customerRating" INTEGER,
  ADD COLUMN "customerRatingText" TEXT,
  ADD COLUMN "customerRatingSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "salesRating" INTEGER,
  ADD COLUMN "salesRatingText" TEXT,
  ADD COLUMN "salesRatingSubmittedAt" TIMESTAMP(3);
