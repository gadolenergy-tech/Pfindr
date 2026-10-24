-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "vendor_images" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "keys" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_lines" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "brand" TEXT,
    "imageUrl" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "checkout_lines_pkey" PRIMARY KEY ("id")
);

-- Existing sessions each held exactly one product: move it into a line.
INSERT INTO "checkout_lines" ("id", "sessionId", "inventoryItemId", "name", "sku", "quantity", "unitPrice", "lineTotal")
SELECT 'cl_' || "id", "id", "inventoryItemId", "name", "sku", "quantity", "unitPrice", "total"
FROM "checkout_sessions";

-- DropForeignKey
ALTER TABLE "checkout_sessions" DROP CONSTRAINT "checkout_sessions_inventoryItemId_fkey";

-- AlterTable
ALTER TABLE "checkout_sessions" DROP COLUMN "inventoryItemId",
DROP COLUMN "name",
DROP COLUMN "sku",
DROP COLUMN "quantity",
DROP COLUMN "unitPrice";

-- CreateIndex
CREATE INDEX "vendor_images_vendorId_idx" ON "vendor_images"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_images_vendorId_url_key" ON "vendor_images"("vendorId", "url");

-- CreateIndex
CREATE INDEX "checkout_lines_sessionId_idx" ON "checkout_lines"("sessionId");

-- AddForeignKey
ALTER TABLE "vendor_images" ADD CONSTRAINT "vendor_images_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_lines" ADD CONSTRAINT "checkout_lines_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "checkout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_lines" ADD CONSTRAINT "checkout_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
