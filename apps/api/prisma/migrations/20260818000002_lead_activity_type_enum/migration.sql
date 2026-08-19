-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM (
  'created',
  'assigned',
  'status_change',
  'visit',
  'reservation',
  'relinked_away',
  'relinked_from',
  'broker_submitted',
  'broker_approved',
  'broker_rejected',
  'broker_marked_duplicate',
  'broker_note',
  'broker_visit_requested',
  'broker_submitted_via_visit',
  'broker_reservation_created',
  'broker_contract_created',
  'broker_contract_signed',
  'broker_commission_earned',
  'broker_commission_approved',
  'broker_commission_rejected',
  'broker_commission_cancelled'
);

-- AlterTable: cast existing String values to the new enum type.
-- All existing values match the enum members defined above.
ALTER TABLE "LeadActivity"
  ALTER COLUMN "type" TYPE "LeadActivityType"
    USING ("type"::"LeadActivityType");
