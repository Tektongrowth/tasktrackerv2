-- AlterTable: Add business detail fields to clients
ALTER TABLE "clients" ADD COLUMN "contact_name" TEXT;
ALTER TABLE "clients" ADD COLUMN "address" TEXT;
ALTER TABLE "clients" ADD COLUMN "city" TEXT;
ALTER TABLE "clients" ADD COLUMN "state" TEXT;
ALTER TABLE "clients" ADD COLUMN "zip" TEXT;
ALTER TABLE "clients" ADD COLUMN "website_url" TEXT;
ALTER TABLE "clients" ADD COLUMN "service_area" TEXT;
ALTER TABLE "clients" ADD COLUMN "primary_services" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: Add Drive folder and Cosmo Sheet URLs to projects
ALTER TABLE "projects" ADD COLUMN "drive_folder_url" TEXT;
ALTER TABLE "projects" ADD COLUMN "cosmo_sheet_url" TEXT;
