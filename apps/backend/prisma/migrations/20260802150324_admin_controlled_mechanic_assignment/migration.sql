-- Removes automatic mechanic matching (legacy nearest-technician auto-assign
-- and the emergency-job wave dispatch engine) in favor of pure admin-
-- controlled manual assignment. Every new booking now starts in
-- PENDING_ADMIN_ASSIGNMENT and waits for an admin to pick a mechanic; the
-- assigned mechanic then has ASSIGNMENT_RESPONSE_WINDOW_MS (60s) to accept or
-- reject, enforced by the sweeper (sweepExpiredAssignments in
-- dispatch.service.ts), not a client-side timer.
--
-- Purely additive: no enum value or column is dropped -- this is a live
-- production system and Postgres cannot drop an enum value still referenced
-- by historical rows anyway. SEARCHING and NO_MECHANIC_FOUND remain valid
-- enum values so old rows still satisfy the schema; no code writes them any
-- more.
--
-- The data backfill (moving existing rows out of the retired statuses) AND
-- the column default (also a use of the new value) are BOTH pushed into the
-- separate …_admin_assignment_backfill migration rather than appended here:
-- Postgres refuses to use a newly-added enum value -- including as a column
-- DEFAULT -- inside the same transaction that added it, and each
-- migration.sql runs as one transaction. (First deploy attempt hit exactly
-- this as error 55P04 on the SET DEFAULT line below; fixed by moving it.)

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'PENDING_ADMIN_ASSIGNMENT';

-- AlterTable
ALTER TABLE "ServiceBooking" ADD COLUMN     "assignmentExpiresAt" TIMESTAMP(3);

-- DropIndex
DROP INDEX "ServiceBooking_status_dispatchStartedAt_idx";

-- CreateIndex
CREATE INDEX "ServiceBooking_status_assignmentExpiresAt_idx" ON "ServiceBooking"("status", "assignmentExpiresAt");
