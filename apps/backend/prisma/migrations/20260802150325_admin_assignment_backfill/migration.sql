-- Data backfill for the admin-controlled-assignment migration
-- (…_admin_controlled_mechanic_assignment). Run as its own transaction,
-- strictly after that migration commits, because Postgres will not let a
-- transaction use an enum value it just added with ALTER TYPE ... ADD VALUE.
--
-- Moves any currently non-terminal, unassigned booking out of the retired
-- auto-matching statuses (PENDING/CONFIRMED/SEARCHING/NO_MECHANIC_FOUND) and
-- into the new admin queue (PENDING_ADMIN_ASSIGNMENT), and closes any
-- dispatch offer left open by the old wave engine mid-flight. Idempotent --
-- safe to run more than once, since the WHERE clauses only match rows still
-- in the old states.

UPDATE "ServiceBooking"
SET "status" = 'PENDING_ADMIN_ASSIGNMENT', "dispatchWave" = 0, "dispatchEndedAt" = NOW()
WHERE "status" IN ('PENDING', 'CONFIRMED', 'SEARCHING', 'NO_MECHANIC_FOUND');

UPDATE "JobDispatchOffer"
SET "status" = 'EXPIRED', "respondedAt" = NOW()
WHERE "status" = 'OFFERED';
