-- Visit request and visit appointment numbers are per company (VR-2026-0001,
-- VA-2026-0001), but their unique indexes spanned every company: once one company
-- held VA-2026-0001 no other company could schedule a visit (500). The numbers
-- are now unique per company, like reservation and contract numbers.
DROP INDEX "VisitRequest_requestNumber_key";
DROP INDEX "VisitAppointment_visitNumber_key";
CREATE UNIQUE INDEX "VisitRequest_companyId_requestNumber_key" ON "VisitRequest"("companyId", "requestNumber");
CREATE UNIQUE INDEX "VisitAppointment_companyId_visitNumber_key" ON "VisitAppointment"("companyId", "visitNumber");
