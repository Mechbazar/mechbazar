-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER', 'VENDOR_MANAGER', 'FINANCE_MANAGER', 'CUSTOMER_SUPPORT', 'VENDOR', 'DELIVERY_PARTNER', 'SERVICE_TECHNICIAN');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'UNDER_VERIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED', 'BLOCKED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RiderStatus" AS ENUM ('PENDING', 'UNDER_VERIFICATION', 'RESUBMISSION_REQUIRED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'BLOCKED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLACED', 'ACCEPTED', 'PACKING', 'PICKUP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'RAZORPAY', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TechnicianStatus" AS ENUM ('PENDING', 'UNDER_VERIFICATION', 'RESUBMISSION_REQUIRED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'BLOCKED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SEARCHING', 'MECHANIC_ASSIGNED', 'MECHANIC_ACCEPTED', 'MECHANIC_ON_THE_WAY', 'ARRIVED', 'WORK_STARTED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'NO_MECHANIC_FOUND');

-- CreateEnum
CREATE TYPE "DispatchOfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobOtpPurpose" AS ENUM ('START', 'COMPLETION');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('RETAIL', 'WHOLESALE', 'BOTH');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'BIKE');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FLAT');

-- CreateEnum
CREATE TYPE "ProductApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BannerType" AS ENUM ('HOMEPAGE', 'CATEGORY', 'PROMO');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "StockMovementAction" AS ENUM ('PURCHASE', 'SALE', 'RETURN', 'DAMAGE', 'ADJUSTMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('PENDING', 'APPROVED', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'ORDERED', 'RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SKIPPED', 'SENT', 'FAILED', 'DELIVERED', 'BOUNCED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "password" TEXT,
    "firebaseUid" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "roles" "Role"[] DEFAULT ARRAY['CUSTOMER']::"Role"[],
    "accountType" "AccountType" NOT NULL DEFAULT 'RETAIL',
    "companyName" TEXT,
    "contactPerson" TEXT,
    "gstNumber" TEXT,
    "businessType" TEXT,
    "city" TEXT,
    "state" TEXT,
    "isBusinessVerified" BOOLEAN NOT NULL DEFAULT false,
    "avatar" TEXT,
    "gender" TEXT,
    "dob" TEXT,
    "wallet" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "expoPushToken" TEXT,
    "fcmToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletionReason" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "businessType" TEXT,
    "categories" TEXT[],
    "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" "VendorStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "placeId" TEXT,
    "formattedAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorDocument" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBankAccount" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorSettlement" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryPartner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "expoPushToken" TEXT,
    "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" "RiderStatus" NOT NULL DEFAULT 'PENDING',
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "placeId" TEXT,
    "formattedAddress" TEXT,
    "country" TEXT,
    "aadhaarNumber" TEXT,
    "vehicleModel" TEXT,
    "vehicleRegistrationNumber" TEXT,
    "insurancePolicyNumber" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "pucNumber" TEXT,
    "pucExpiry" TIMESTAMP(3),
    "upiId" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "remarks" TEXT,

    CONSTRAINT "DeliveryPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderDocument" (
    "id" TEXT NOT NULL,
    "deliveryPartnerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileData" BYTEA,
    "mimeType" TEXT,
    "status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderBankAccount" (
    "id" TEXT NOT NULL,
    "deliveryPartnerId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiderBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderSettlement" (
    "id" TEXT NOT NULL,
    "deliveryPartnerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "placeId" TEXT,
    "formattedAddress" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL DEFAULT 'CAR',
    "logo" TEXT,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "FuelType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "variantId" TEXT,
    "fuelTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "engineCc" INTEGER,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVehicle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "vehicleType" "VehicleType" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" TEXT,
    "fuelType" TEXT,
    "engine" TEXT,
    "transmission" TEXT,
    "trim" TEXT,
    "registrationNumber" TEXT,
    "nickname" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "icon" TEXT DEFAULT '📦',
    "status" TEXT DEFAULT 'Active',
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'CAR',
    "parentId" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'CAR',

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mrp" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[],
    "oemNumber" TEXT,
    "partNumber" TEXT,
    "status" "ProductApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'CAR',
    "discountPrice" DOUBLE PRECISION,
    "b2bPrice" DOUBLE PRECISION,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isDeal" BOOLEAN NOT NULL DEFAULT false,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "compatibleModels" TEXT,
    "specifications" JSONB,
    "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCompatibility" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,

    CONSTRAINT "ProductCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "deliveryPartnerId" TEXT,
    "couponId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalAmount" DOUBLE PRECISION NOT NULL,
    "proofImageUrl" TEXT,
    "codCollected" BOOLEAN NOT NULL DEFAULT false,
    "issueReason" TEXT,
    "deliveryOtp" TEXT,
    "deliveryOtpGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "serviceBookingId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "transactionId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "minOrderValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vehicleType" "VehicleType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT,
    "data" JSONB,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "type" "BannerType" NOT NULL DEFAULT 'HOMEPAGE',
    "link" TEXT,
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'CAR',
    "buttonText" TEXT,
    "redirectLink" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "placeId" TEXT,
    "formattedAddress" TEXT,
    "managerName" TEXT,
    "phone" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstNumber" TEXT,
    "address" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "placeId" TEXT,
    "formattedAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "availableStock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "damagedStock" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mfgDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "StockMovementAction" NOT NULL,
    "prevQuantity" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "quantityDiff" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'PENDING',
    "transferDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DOUBLE PRECISION NOT NULL,
    "minOrderValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "code" TEXT,
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'CAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTechnician" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specializations" "VehicleType"[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "lastHeadingDeg" DOUBLE PRECISION,
    "lastSpeedMps" DOUBLE PRECISION,
    "expoPushToken" TEXT,
    "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalJobs" INTEGER NOT NULL DEFAULT 0,
    "status" "TechnicianStatus" NOT NULL DEFAULT 'PENDING',
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "placeId" TEXT,
    "formattedAddress" TEXT,
    "country" TEXT,
    "aadhaarNumber" TEXT,
    "skills" TEXT[],
    "experienceYears" INTEGER,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "remarks" TEXT,

    CONSTRAINT "ServiceTechnician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianDocument" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileData" BYTEA,
    "mimeType" TEXT,
    "status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicianDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianBankAccount" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicianBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianSettlement" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicianSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT DEFAULT '🔧',
    "image" TEXT,
    "description" TEXT,
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'CAR',
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePackage" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "discountPrice" DOUBLE PRECISION,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
    "includedServices" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSlot" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "maxBookingsPerSlot" INTEGER NOT NULL DEFAULT 20,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceBooking" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userVehicleId" TEXT,
    "vehicleType" "VehicleType" NOT NULL,
    "vehicleBrand" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "vehicleFuelType" TEXT,
    "vehicleRegistrationNumber" TEXT,
    "categoryId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "technicianId" TEXT,
    "addressId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3),
    "timeSlotId" TEXT,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "jobLat" DOUBLE PRECISION,
    "jobLng" DOUBLE PRECISION,
    "jobAddressText" TEXT,
    "landmark" TEXT,
    "customerNotes" TEXT,
    "issueDescription" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "additionalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalAmount" DOUBLE PRECISION NOT NULL,
    "approvalStatus" TEXT,
    "approvalNote" TEXT,
    "cancelReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "dispatchWave" INTEGER NOT NULL DEFAULT 0,
    "dispatchStartedAt" TIMESTAMP(3),
    "dispatchEndedAt" TIMESTAMP(3),
    "dispatchRadiusKm" DOUBLE PRECISION,
    "acceptedAt" TIMESTAMP(3),
    "enRouteAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "startOtpVerifiedAt" TIMESTAMP(3),
    "completionOtpVerifiedAt" TIMESTAMP(3),
    "paymentCompletedAt" TIMESTAMP(3),
    "ratedAt" TIMESTAMP(3),
    "verifiedByCustomer" BOOLEAN NOT NULL DEFAULT false,
    "distanceTravelledKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "etaSeconds" INTEGER,
    "distanceRemainingM" INTEGER,
    "etaUpdatedAt" TIMESTAMP(3),
    "routePolyline" TEXT,
    "completionOtp" TEXT,
    "completionOtpGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDispatchOffer" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "wave" INTEGER NOT NULL DEFAULT 1,
    "status" "DispatchOfferStatus" NOT NULL DEFAULT 'OFFERED',
    "distanceKm" DOUBLE PRECISION,
    "etaSeconds" INTEGER,
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "notifiedVia" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "JobDispatchOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOtp" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "purpose" "JobOtpPurpose" NOT NULL,
    "codeEnc" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "JobOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLocationPing" (
    "id" SERIAL NOT NULL,
    "bookingId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION,
    "headingDeg" DOUBLE PRECISION,
    "speedMps" DOUBLE PRECISION,
    "batteryPct" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "fromRole" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerCallSid" TEXT,
    "virtualNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "failureReason" TEXT,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingStatusHistory" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "note" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceChatMessage" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceImage" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fileData" BYTEA,
    "mimeType" TEXT,
    "type" TEXT NOT NULL,
    "uploadedByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,
    "capturedAt" TIMESTAMP(3),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "sha256" TEXT,
    "sizeBytes" INTEGER,

    CONSTRAINT "ServiceImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceReview" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imageData" BYTEA,
    "imageMimeType" TEXT,

    CONSTRAINT "ServiceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceInvoice" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "additionalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_userId_key" ON "Vendor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartner_userId_key" ON "DeliveryPartner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_name_type_key" ON "Manufacturer"("name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FuelType_name_key" ON "FuelType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_manufacturerId_modelId_variantId_fuelTypeId_year_key" ON "Vehicle"("manufacturerId", "modelId", "variantId", "fuelTypeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_vehicleType_key" ON "Category"("name", "vehicleType");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE INDEX "Product_vendorId_idx" ON "Product"("vendorId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_avgRating_idx" ON "Product"("avgRating");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCompatibility_productId_vehicleId_key" ON "ProductCompatibility"("productId", "vehicleId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_deliveryPartnerId_idx" ON "Order"("deliveryPartnerId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_serviceBookingId_key" ON "Payment"("serviceBookingId");

-- CreateIndex
CREATE INDEX "Payment_gatewayOrderId_idx" ON "Payment"("gatewayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Review_productId_idx" ON "Review"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON "Wishlist"("userId", "productId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_type_createdAt_idx" ON "Notification"("userId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_providerMessageId_key" ON "EmailLog"("providerMessageId");

-- CreateIndex
CREATE INDEX "EmailLog_to_createdAt_idx" ON "EmailLog"("to", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_warehouseId_key" ON "Inventory"("productId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_code_key" ON "Offer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTechnician_userId_key" ON "ServiceTechnician"("userId");

-- CreateIndex
CREATE INDEX "ServiceTechnician_isOnline_isActive_status_idx" ON "ServiceTechnician"("isOnline", "isActive", "status");

-- CreateIndex
CREATE INDEX "ServiceTechnician_lastLocationAt_idx" ON "ServiceTechnician"("lastLocationAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_name_vehicleType_key" ON "ServiceCategory"("name", "vehicleType");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceBooking_bookingNumber_key" ON "ServiceBooking"("bookingNumber");

-- CreateIndex
CREATE INDEX "ServiceBooking_userId_idx" ON "ServiceBooking"("userId");

-- CreateIndex
CREATE INDEX "ServiceBooking_technicianId_idx" ON "ServiceBooking"("technicianId");

-- CreateIndex
CREATE INDEX "ServiceBooking_status_idx" ON "ServiceBooking"("status");

-- CreateIndex
CREATE INDEX "ServiceBooking_createdAt_idx" ON "ServiceBooking"("createdAt");

-- CreateIndex
CREATE INDEX "ServiceBooking_scheduledDate_idx" ON "ServiceBooking"("scheduledDate");

-- CreateIndex
CREATE INDEX "ServiceBooking_isEmergency_status_createdAt_idx" ON "ServiceBooking"("isEmergency", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceBooking_status_dispatchStartedAt_idx" ON "ServiceBooking"("status", "dispatchStartedAt");

-- CreateIndex
CREATE INDEX "JobDispatchOffer_technicianId_status_idx" ON "JobDispatchOffer"("technicianId", "status");

-- CreateIndex
CREATE INDEX "JobDispatchOffer_status_expiresAt_idx" ON "JobDispatchOffer"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "JobDispatchOffer_bookingId_status_idx" ON "JobDispatchOffer"("bookingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JobDispatchOffer_bookingId_technicianId_key" ON "JobDispatchOffer"("bookingId", "technicianId");

-- CreateIndex
CREATE INDEX "JobOtp_bookingId_purpose_consumedAt_idx" ON "JobOtp"("bookingId", "purpose", "consumedAt");

-- CreateIndex
CREATE INDEX "JobOtp_expiresAt_idx" ON "JobOtp"("expiresAt");

-- CreateIndex
CREATE INDEX "JobLocationPing_bookingId_recordedAt_idx" ON "JobLocationPing"("bookingId", "recordedAt");

-- CreateIndex
CREATE INDEX "JobLocationPing_technicianId_recordedAt_idx" ON "JobLocationPing"("technicianId", "recordedAt");

-- CreateIndex
CREATE INDEX "CallSession_bookingId_createdAt_idx" ON "CallSession"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceChatMessage_bookingId_idx" ON "ServiceChatMessage"("bookingId");

-- CreateIndex
CREATE INDEX "ServiceImage_bookingId_type_idx" ON "ServiceImage"("bookingId", "type");

-- CreateIndex
CREATE INDEX "ServiceImage_bookingId_sha256_idx" ON "ServiceImage"("bookingId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceReview_bookingId_key" ON "ServiceReview"("bookingId");

-- CreateIndex
CREATE INDEX "ServiceReview_technicianId_idx" ON "ServiceReview"("technicianId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceInvoice_bookingId_key" ON "ServiceInvoice"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceInvoice_invoiceNumber_key" ON "ServiceInvoice"("invoiceNumber");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDocument" ADD CONSTRAINT "VendorDocument_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBankAccount" ADD CONSTRAINT "VendorBankAccount_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSettlement" ADD CONSTRAINT "VendorSettlement_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPartner" ADD CONSTRAINT "DeliveryPartner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderDocument" ADD CONSTRAINT "RiderDocument_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "DeliveryPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderBankAccount" ADD CONSTRAINT "RiderBankAccount_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "DeliveryPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderSettlement" ADD CONSTRAINT "RiderSettlement_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "DeliveryPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_fuelTypeId_fkey" FOREIGN KEY ("fuelTypeId") REFERENCES "FuelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVehicle" ADD CONSTRAINT "UserVehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVehicle" ADD CONSTRAINT "UserVehicle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "DeliveryPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_serviceBookingId_fkey" FOREIGN KEY ("serviceBookingId") REFERENCES "ServiceBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTechnician" ADD CONSTRAINT "ServiceTechnician_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianDocument" ADD CONSTRAINT "TechnicianDocument_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "ServiceTechnician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianBankAccount" ADD CONSTRAINT "TechnicianBankAccount_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "ServiceTechnician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianSettlement" ADD CONSTRAINT "TechnicianSettlement_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "ServiceTechnician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_userVehicleId_fkey" FOREIGN KEY ("userVehicleId") REFERENCES "UserVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ServicePackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "ServiceTechnician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDispatchOffer" ADD CONSTRAINT "JobDispatchOffer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDispatchOffer" ADD CONSTRAINT "JobDispatchOffer_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "ServiceTechnician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOtp" ADD CONSTRAINT "JobOtp_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLocationPing" ADD CONSTRAINT "JobLocationPing_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLocationPing" ADD CONSTRAINT "JobLocationPing_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "ServiceTechnician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ServiceBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceChatMessage" ADD CONSTRAINT "ServiceChatMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ServiceBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceImage" ADD CONSTRAINT "ServiceImage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ServiceBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "ServiceTechnician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceInvoice" ADD CONSTRAINT "ServiceInvoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ServiceBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

