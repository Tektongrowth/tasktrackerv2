-- Create task_assignees join table for multiple assignees
CREATE TABLE "task_assignees" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "task_assignees_task_id_idx" ON "task_assignees"("task_id");
CREATE INDEX "task_assignees_user_id_idx" ON "task_assignees"("user_id");

-- Create unique constraint to prevent duplicate assignments
CREATE UNIQUE INDEX "task_assignees_task_id_user_id_key" ON "task_assignees"("task_id", "user_id");

-- Add foreign key constraints
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing assigned_to data to new table
INSERT INTO "task_assignees" ("id", "task_id", "user_id", "assigned_at")
SELECT
    gen_random_uuid()::text,
    "id",
    "assigned_to",
    COALESCE("updated_at", "created_at")
FROM "tasks"
WHERE "assigned_to" IS NOT NULL;

-- Drop the old assigned_to column and its index
DROP INDEX IF EXISTS "tasks_assigned_to_idx";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "assigned_to";
