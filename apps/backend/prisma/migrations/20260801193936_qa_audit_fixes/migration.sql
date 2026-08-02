-- AlterEnum
ALTER TYPE "VendorStatus" ADD VALUE 'RESUBMISSION_REQUIRED';

-- AlterTable
ALTER TABLE "VendorDocument" ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "filePath" TEXT,
ADD COLUMN     "mimeType" TEXT,
ALTER COLUMN "url" DROP NOT NULL;

-- AlterTable
-- `prisma migrate diff` doesn't know these tables already have rows in a
-- real environment -- it emits `updatedAt ... NOT NULL` with no default,
-- which fails outright against any existing row (`ADD COLUMN` on a non-empty
-- table can't satisfy NOT NULL with nothing to fill it). Hand-added
-- `DEFAULT CURRENT_TIMESTAMP` below so existing rows backfill to "now" at
-- migration time; Prisma's `@updatedAt` takes over from the next write.
ALTER TABLE "DeliveryPartner" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ServiceTechnician" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "ProductCompatibility_vehicleId_idx" ON "ProductCompatibility"("vehicleId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "StockMovement_inventoryId_idx" ON "StockMovement"("inventoryId");

-- CreateIndex
CREATE INDEX "StockMovement_userId_idx" ON "StockMovement"("userId");

