-- CreateTable
CREATE TABLE "vendor_daily_stats" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "profileViews" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vendor_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_daily_stats_day_idx" ON "vendor_daily_stats"("day");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_daily_stats_vendorId_day_key" ON "vendor_daily_stats"("vendorId", "day");

-- AddForeignKey
ALTER TABLE "vendor_daily_stats" ADD CONSTRAINT "vendor_daily_stats_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
