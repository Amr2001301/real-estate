-- P8 — booking amount mode (FIXED | PERCENTAGE) + audit fields.
--
-- Existing rows default to FIXED so historical reservations remain unchanged.
-- `bookingAmount` stays the source of truth at runtime; the new columns
-- preserve admin intent for audit and for re-deriving the math if the unit's
-- price changes after the reservation was created.

CREATE TYPE "ReservationBookingAmountMode" AS ENUM ('FIXED', 'PERCENTAGE');

ALTER TABLE "Reservation"
  ADD COLUMN "bookingAmountMode" "ReservationBookingAmountMode" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "bookingAmountPercent" DECIMAL(5,2),
  ADD COLUMN "bookingAmountUnitPriceSnapshot" DECIMAL(14,2);
