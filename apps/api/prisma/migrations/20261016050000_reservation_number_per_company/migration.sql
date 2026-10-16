-- Reservation numbers run per company (like contract numbers). The global
-- unique index made a second company's first reservation collide with the
-- first company's RES-<year>-0001.
DROP INDEX "Reservation_reservationNumber_key";
CREATE UNIQUE INDEX "Reservation_companyId_reservationNumber_key" ON "Reservation"("companyId", "reservationNumber");
