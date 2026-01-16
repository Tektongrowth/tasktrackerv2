-- AlterTable
ALTER TABLE "users" ADD COLUMN "notification_preferences" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "email_templates" JSONB NOT NULL DEFAULT '{}';
