-- Revert many-to-many relationship back to single template_set_id

-- Add template_set_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_templates' AND column_name = 'template_set_id') THEN
        ALTER TABLE "task_templates" ADD COLUMN "template_set_id" TEXT;
    END IF;
END $$;

-- Migrate data from join table back to template_set_id (take first relationship only)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_TemplateSetToTaskTemplate') THEN
        UPDATE "task_templates" t
        SET "template_set_id" = (
            SELECT "A" FROM "_TemplateSetToTaskTemplate" j
            WHERE j."B" = t."id"
            LIMIT 1
        )
        WHERE "template_set_id" IS NULL;
    END IF;
END $$;

-- Create index on template_set_id if it doesn't exist
CREATE INDEX IF NOT EXISTS "task_templates_template_set_id_idx" ON "task_templates"("template_set_id");

-- Add foreign key if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_templates_template_set_id_fkey') THEN
        ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_template_set_id_fkey"
        FOREIGN KEY ("template_set_id") REFERENCES "template_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Drop the join table if it exists
DROP TABLE IF EXISTS "_TemplateSetToTaskTemplate";
