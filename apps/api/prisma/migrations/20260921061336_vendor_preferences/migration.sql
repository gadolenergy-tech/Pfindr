-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "preferences" JSONB NOT NULL DEFAULT '{}';
