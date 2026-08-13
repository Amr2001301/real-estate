-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "BonusEntry" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "BonusRule" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Broker" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "BrokerActivityLog" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "BrokerCommission" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "BrokerPayout" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "BrokerProjectAccess" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "BrokerUnitAccess" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "BrokerUser" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "ChatFeedback" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "CmsPage" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "InfoRequest" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "InstallmentPlan" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "InstallmentPlanTemplate" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "LeadActivity" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "LeadNote" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "LeadSource" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "MaintenanceCategory" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "MaintenanceRequestItem" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "NotificationTemplate" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Phase" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "ReservationActivity" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "ReservationNote" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "SalesTarget" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "UnitMaintenanceItem" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "UnitStatusHistory" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "VisitActivity" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "VisitAppointment" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "VisitRequest" ADD COLUMN     "companyId" UUID;

-- CreateIndex
CREATE INDEX "Article_companyId_idx" ON "Article"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "Banner_companyId_idx" ON "Banner"("companyId");

-- CreateIndex
CREATE INDEX "BonusEntry_companyId_idx" ON "BonusEntry"("companyId");

-- CreateIndex
CREATE INDEX "BonusRule_companyId_idx" ON "BonusRule"("companyId");

-- CreateIndex
CREATE INDEX "Broker_companyId_idx" ON "Broker"("companyId");

-- CreateIndex
CREATE INDEX "BrokerActivityLog_companyId_idx" ON "BrokerActivityLog"("companyId");

-- CreateIndex
CREATE INDEX "BrokerCommission_companyId_idx" ON "BrokerCommission"("companyId");

-- CreateIndex
CREATE INDEX "BrokerPayout_companyId_idx" ON "BrokerPayout"("companyId");

-- CreateIndex
CREATE INDEX "BrokerProjectAccess_companyId_idx" ON "BrokerProjectAccess"("companyId");

-- CreateIndex
CREATE INDEX "BrokerUnitAccess_companyId_idx" ON "BrokerUnitAccess"("companyId");

-- CreateIndex
CREATE INDEX "BrokerUser_companyId_idx" ON "BrokerUser"("companyId");

-- CreateIndex
CREATE INDEX "Building_companyId_idx" ON "Building"("companyId");

-- CreateIndex
CREATE INDEX "ChatFeedback_companyId_idx" ON "ChatFeedback"("companyId");

-- CreateIndex
CREATE INDEX "ChatMessage_companyId_idx" ON "ChatMessage"("companyId");

-- CreateIndex
CREATE INDEX "ChatSession_companyId_idx" ON "ChatSession"("companyId");

-- CreateIndex
CREATE INDEX "CmsPage_companyId_idx" ON "CmsPage"("companyId");

-- CreateIndex
CREATE INDEX "Contract_companyId_idx" ON "Contract"("companyId");

-- CreateIndex
CREATE INDEX "Deposit_companyId_idx" ON "Deposit"("companyId");

-- CreateIndex
CREATE INDEX "Document_companyId_idx" ON "Document"("companyId");

-- CreateIndex
CREATE INDEX "InfoRequest_companyId_idx" ON "InfoRequest"("companyId");

-- CreateIndex
CREATE INDEX "Installment_companyId_idx" ON "Installment"("companyId");

-- CreateIndex
CREATE INDEX "InstallmentPlan_companyId_idx" ON "InstallmentPlan"("companyId");

-- CreateIndex
CREATE INDEX "InstallmentPlanTemplate_companyId_idx" ON "InstallmentPlanTemplate"("companyId");

-- CreateIndex
CREATE INDEX "Lead_companyId_idx" ON "Lead"("companyId");

-- CreateIndex
CREATE INDEX "LeadActivity_companyId_idx" ON "LeadActivity"("companyId");

-- CreateIndex
CREATE INDEX "LeadNote_companyId_idx" ON "LeadNote"("companyId");

-- CreateIndex
CREATE INDEX "LeadSource_companyId_idx" ON "LeadSource"("companyId");

-- CreateIndex
CREATE INDEX "MaintenanceCategory_companyId_idx" ON "MaintenanceCategory"("companyId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_companyId_idx" ON "MaintenanceRequest"("companyId");

-- CreateIndex
CREATE INDEX "MaintenanceRequestItem_companyId_idx" ON "MaintenanceRequestItem"("companyId");

-- CreateIndex
CREATE INDEX "Notification_companyId_idx" ON "Notification"("companyId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_companyId_idx" ON "NotificationTemplate"("companyId");

-- CreateIndex
CREATE INDEX "Phase_companyId_idx" ON "Phase"("companyId");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE INDEX "Reservation_companyId_idx" ON "Reservation"("companyId");

-- CreateIndex
CREATE INDEX "ReservationActivity_companyId_idx" ON "ReservationActivity"("companyId");

-- CreateIndex
CREATE INDEX "ReservationNote_companyId_idx" ON "ReservationNote"("companyId");

-- CreateIndex
CREATE INDEX "SalesTarget_companyId_idx" ON "SalesTarget"("companyId");

-- CreateIndex
CREATE INDEX "Setting_companyId_idx" ON "Setting"("companyId");

-- CreateIndex
CREATE INDEX "Unit_companyId_idx" ON "Unit"("companyId");

-- CreateIndex
CREATE INDEX "UnitMaintenanceItem_companyId_idx" ON "UnitMaintenanceItem"("companyId");

-- CreateIndex
CREATE INDEX "UnitStatusHistory_companyId_idx" ON "UnitStatusHistory"("companyId");

-- CreateIndex
CREATE INDEX "VisitActivity_companyId_idx" ON "VisitActivity"("companyId");

-- CreateIndex
CREATE INDEX "VisitAppointment_companyId_idx" ON "VisitAppointment"("companyId");

-- CreateIndex
CREATE INDEX "VisitRequest_companyId_idx" ON "VisitRequest"("companyId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitStatusHistory" ADD CONSTRAINT "UnitStatusHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSource" ADD CONSTRAINT "LeadSource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfoRequest" ADD CONSTRAINT "InfoRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitActivity" ADD CONSTRAINT "VisitActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationNote" ADD CONSTRAINT "ReservationNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationActivity" ADD CONSTRAINT "ReservationActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlanTemplate" ADD CONSTRAINT "InstallmentPlanTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusRule" ADD CONSTRAINT "BonusRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusEntry" ADD CONSTRAINT "BonusEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceCategory" ADD CONSTRAINT "MaintenanceCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitMaintenanceItem" ADD CONSTRAINT "UnitMaintenanceItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequestItem" ADD CONSTRAINT "MaintenanceRequestItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPage" ADD CONSTRAINT "CmsPage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broker" ADD CONSTRAINT "Broker_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerUser" ADD CONSTRAINT "BrokerUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerProjectAccess" ADD CONSTRAINT "BrokerProjectAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerUnitAccess" ADD CONSTRAINT "BrokerUnitAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerCommission" ADD CONSTRAINT "BrokerCommission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerPayout" ADD CONSTRAINT "BrokerPayout_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerActivityLog" ADD CONSTRAINT "BrokerActivityLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatFeedback" ADD CONSTRAINT "ChatFeedback_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
