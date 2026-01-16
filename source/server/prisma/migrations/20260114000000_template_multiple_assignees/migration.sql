-- Add new array column for multiple assignee emails
ALTER TABLE "task_templates" ADD COLUMN "default_assignee_emails" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Migrate existing single email to array (if exists)
UPDATE "task_templates"
SET "default_assignee_emails" = ARRAY["default_assignee_email"]
WHERE "default_assignee_email" IS NOT NULL;

-- Drop the old column
ALTER TABLE "task_templates" DROP COLUMN IF EXISTS "default_assignee_email";
