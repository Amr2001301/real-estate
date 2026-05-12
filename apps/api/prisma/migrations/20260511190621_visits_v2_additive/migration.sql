/*
  Warnings:

  - A unique constraint covering the columns `[requestNumber]` on the table `VisitRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "VisitRequestStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'CONVERTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VisitRequestSource" AS ENUM ('WEBSITE', 'MOBILE_APP', 'SALES', 'PHONE', 'WHATSAPP', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "VisitActivityType" AS ENUM ('REQUEST_CREATED', 'REQUEST_REVIEWED', 'REQUEST_REJECTED', 'REQUEST_CANCELLED', 'VISIT_SCHEDULED', 'VISIT_CONFIRMED', 'VISIT_COMPLETED', 'VISIT_CANCELLED', 'VISIT_NO_SHOW', 'VISIT_RESCHEDULED', 'SALES_ASSIGNED', 'NOTE_ADDED');

-- AlterTable
ALTER TABLE "VisitRequest" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "preferredContactMethod" TEXT,
ADD COLUMN     "preferredTime" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "requestNotes" TEXT,
ADD COLUMN     "requestNumber" TEXT,
ADD COLUMN     "requestStatus" "VisitRequestStatus",
ADD COLUMN     "source" "VisitRequestSource";

-- CreateTable
CREATE TABLE "VisitAppointment" (
    "id" UUID NOT NULL,
    "visitNumber" TEXT NOT NULL,
    "visitRequestId" UUID,
    "leadId" UUID,
    "clientId" UUID,
    "projectId" UUID,
    "unitId" UUID,
    "assignedSalesId" UUID,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "location" TEXT,
    "meetingPoint" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "salesNotes" TEXT,
    "customerFeedback" TEXT,
    "resultNotes" TEXT,
    "cancellationReason" TEXT,
    "noShowReason" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "noShowAt" TIMESTAMP(3),

    CONSTRAINT "VisitAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitActivity" (
    "id" UUID NOT NULL,
    "visitRequestId" UUID,
    "visitId" UUID,
    "leadId" UUID,
    "clientId" UUID,
    "actorId" UUID,
    "actorRole" TEXT,
    "type" "VisitActivityType" NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitAppointment_visitNumber_key" ON "VisitAppointment"("visitNumber");

-- CreateIndex
CREATE INDEX "VisitAppointment_status_idx" ON "VisitAppointment"("status");

-- CreateIndex
CREATE INDEX "VisitAppointment_scheduledAt_idx" ON "VisitAppointment"("scheduledAt");

-- CreateIndex
CREATE INDEX "VisitAppointment_visitRequestId_idx" ON "VisitAppointment"("visitRequestId");

-- CreateIndex
CREATE INDEX "VisitAppointment_assignedSalesId_idx" ON "VisitAppointment"("assignedSalesId");

-- CreateIndex
CREATE INDEX "VisitAppointment_leadId_idx" ON "VisitAppointment"("leadId");

-- CreateIndex
CREATE INDEX "VisitAppointment_clientId_idx" ON "VisitAppointment"("clientId");

-- CreateIndex
CREATE INDEX "VisitActivity_visitRequestId_idx" ON "VisitActivity"("visitRequestId");

-- CreateIndex
CREATE INDEX "VisitActivity_visitId_idx" ON "VisitActivity"("visitId");

-- CreateIndex
CREATE INDEX "VisitActivity_leadId_idx" ON "VisitActivity"("leadId");

-- CreateIndex
CREATE INDEX "VisitActivity_clientId_idx" ON "VisitActivity"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitRequest_requestNumber_key" ON "VisitRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "VisitRequest_requestStatus_idx" ON "VisitRequest"("requestStatus");

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_visitRequestId_fkey" FOREIGN KEY ("visitRequestId") REFERENCES "VisitRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_assignedSalesId_fkey" FOREIGN KEY ("assignedSalesId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitActivity" ADD CONSTRAINT "VisitActivity_visitRequestId_fkey" FOREIGN KEY ("visitRequestId") REFERENCES "VisitRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitActivity" ADD CONSTRAINT "VisitActivity_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "VisitAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitActivity" ADD CONSTRAINT "VisitActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitActivity" ADD CONSTRAINT "VisitActivity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitActivity" ADD CONSTRAINT "VisitActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
