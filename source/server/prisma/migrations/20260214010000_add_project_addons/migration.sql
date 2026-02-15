-- AlterTable
ALTER TABLE "projects" ADD COLUMN "add_ons" "PlanType"[] DEFAULT ARRAY[]::"PlanType"[];
