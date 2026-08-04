-- Generic admin-editable key/value store. First consumer: the admin
-- Dashboard's monthly revenue target -- purely additive, no existing table
-- touched.

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);
