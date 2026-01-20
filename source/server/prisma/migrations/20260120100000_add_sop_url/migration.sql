-- Add SOP URL to task templates
ALTER TABLE "task_templates" ADD COLUMN "sop_url" TEXT;

-- Add SOP URL to template subtasks
ALTER TABLE "template_subtasks" ADD COLUMN "sop_url" TEXT;
