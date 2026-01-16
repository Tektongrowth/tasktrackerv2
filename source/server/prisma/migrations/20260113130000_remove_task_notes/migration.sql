-- Remove notes column from tasks table (redundant with comments)
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "notes";
