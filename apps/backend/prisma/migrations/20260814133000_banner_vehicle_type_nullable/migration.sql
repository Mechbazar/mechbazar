-- AlterTable
-- vehicleType becomes nullable; null now means "shown for both CAR and BIKE"
-- (same convention already used by Coupon.vehicleType). No data is changed --
-- existing rows keep their explicit CAR/BIKE value.
ALTER TABLE "Banner" ALTER COLUMN "vehicleType" DROP DEFAULT,
ALTER COLUMN "vehicleType" DROP NOT NULL;
