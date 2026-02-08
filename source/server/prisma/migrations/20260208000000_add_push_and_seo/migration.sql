-- CreateTable: push_subscriptions
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- AddForeignKey (conditional)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_user_id_fkey') THEN
    ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SourceTier" AS ENUM ('tier_1', 'tier_2', 'tier_3');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SeoDigestStatus" AS ENUM ('pending', 'fetching', 'analyzing', 'generating', 'delivering', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SeoRecommendationStatus" AS ENUM ('draft', 'approved', 'rejected', 'actioned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SeoTaskDraftStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: seo_settings
CREATE TABLE IF NOT EXISTS "seo_settings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "run_day_of_month" INTEGER NOT NULL DEFAULT 1,
    "telegram_chat_id" TEXT,
    "drive_folder_id" TEXT,
    "sop_folder_id" TEXT,
    "token_budget" INTEGER NOT NULL DEFAULT 100000,
    "retention_months" INTEGER NOT NULL DEFAULT 6,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seo_sources
CREATE TABLE IF NOT EXISTS "seo_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tier" "SourceTier" NOT NULL DEFAULT 'tier_3',
    "category" TEXT NOT NULL DEFAULT 'general',
    "fetch_method" TEXT NOT NULL DEFAULT 'rss',
    "fetch_config" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_fetched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seo_digests
CREATE TABLE IF NOT EXISTS "seo_digests" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "SeoDigestStatus" NOT NULL DEFAULT 'pending',
    "sources_fetched" INTEGER NOT NULL DEFAULT 0,
    "recommendations_generated" INTEGER NOT NULL DEFAULT 0,
    "task_drafts_created" INTEGER NOT NULL DEFAULT 0,
    "sop_drafts_created" INTEGER NOT NULL DEFAULT 0,
    "google_doc_url" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seo_fetch_results
CREATE TABLE IF NOT EXISTS "seo_fetch_results" (
    "id" TEXT NOT NULL,
    "digest_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_fetch_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seo_recommendations
CREATE TABLE IF NOT EXISTS "seo_recommendations" (
    "id" TEXT NOT NULL,
    "digest_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "status" "SeoRecommendationStatus" NOT NULL DEFAULT 'draft',
    "source_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seo_recommendation_citations
CREATE TABLE IF NOT EXISTS "seo_recommendation_citations" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "fetch_result_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_recommendation_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seo_task_drafts
CREATE TABLE IF NOT EXISTS "seo_task_drafts" (
    "id" TEXT NOT NULL,
    "digest_id" TEXT NOT NULL,
    "recommendation_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggested_project_id" TEXT,
    "suggested_priority" TEXT NOT NULL DEFAULT 'medium',
    "suggested_due_in_days" INTEGER NOT NULL DEFAULT 7,
    "status" "SeoTaskDraftStatus" NOT NULL DEFAULT 'pending',
    "task_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_task_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seo_sop_drafts
CREATE TABLE IF NOT EXISTS "seo_sop_drafts" (
    "id" TEXT NOT NULL,
    "digest_id" TEXT NOT NULL,
    "recommendation_id" TEXT,
    "sop_doc_id" TEXT NOT NULL,
    "sop_title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "before_content" TEXT NOT NULL,
    "after_content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_sop_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seo_client_insights
CREATE TABLE IF NOT EXISTS "seo_client_insights" (
    "id" TEXT NOT NULL,
    "digest_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "data_source" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "period" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_client_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes for SEO tables
CREATE INDEX IF NOT EXISTS "seo_fetch_results_digest_id_idx" ON "seo_fetch_results"("digest_id");
CREATE INDEX IF NOT EXISTS "seo_fetch_results_source_id_idx" ON "seo_fetch_results"("source_id");
CREATE INDEX IF NOT EXISTS "seo_fetch_results_content_hash_idx" ON "seo_fetch_results"("content_hash");
CREATE INDEX IF NOT EXISTS "seo_recommendations_digest_id_idx" ON "seo_recommendations"("digest_id");
CREATE INDEX IF NOT EXISTS "seo_recommendations_category_idx" ON "seo_recommendations"("category");
CREATE INDEX IF NOT EXISTS "seo_recommendation_citations_recommendation_id_idx" ON "seo_recommendation_citations"("recommendation_id");
CREATE INDEX IF NOT EXISTS "seo_recommendation_citations_fetch_result_id_idx" ON "seo_recommendation_citations"("fetch_result_id");
CREATE UNIQUE INDEX IF NOT EXISTS "seo_task_drafts_task_id_key" ON "seo_task_drafts"("task_id");
CREATE INDEX IF NOT EXISTS "seo_task_drafts_digest_id_idx" ON "seo_task_drafts"("digest_id");
CREATE INDEX IF NOT EXISTS "seo_task_drafts_status_idx" ON "seo_task_drafts"("status");
CREATE INDEX IF NOT EXISTS "seo_sop_drafts_digest_id_idx" ON "seo_sop_drafts"("digest_id");
CREATE INDEX IF NOT EXISTS "seo_client_insights_digest_id_idx" ON "seo_client_insights"("digest_id");
CREATE INDEX IF NOT EXISTS "seo_client_insights_client_id_idx" ON "seo_client_insights"("client_id");

-- AddForeignKeys for SEO tables (conditional)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_fetch_results_digest_id_fkey') THEN
    ALTER TABLE "seo_fetch_results" ADD CONSTRAINT "seo_fetch_results_digest_id_fkey" FOREIGN KEY ("digest_id") REFERENCES "seo_digests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_fetch_results_source_id_fkey') THEN
    ALTER TABLE "seo_fetch_results" ADD CONSTRAINT "seo_fetch_results_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "seo_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_recommendations_digest_id_fkey') THEN
    ALTER TABLE "seo_recommendations" ADD CONSTRAINT "seo_recommendations_digest_id_fkey" FOREIGN KEY ("digest_id") REFERENCES "seo_digests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_recommendation_citations_recommendation_id_fkey') THEN
    ALTER TABLE "seo_recommendation_citations" ADD CONSTRAINT "seo_recommendation_citations_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "seo_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_recommendation_citations_fetch_result_id_fkey') THEN
    ALTER TABLE "seo_recommendation_citations" ADD CONSTRAINT "seo_recommendation_citations_fetch_result_id_fkey" FOREIGN KEY ("fetch_result_id") REFERENCES "seo_fetch_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_task_drafts_digest_id_fkey') THEN
    ALTER TABLE "seo_task_drafts" ADD CONSTRAINT "seo_task_drafts_digest_id_fkey" FOREIGN KEY ("digest_id") REFERENCES "seo_digests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_task_drafts_recommendation_id_fkey') THEN
    ALTER TABLE "seo_task_drafts" ADD CONSTRAINT "seo_task_drafts_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "seo_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_task_drafts_task_id_fkey') THEN
    ALTER TABLE "seo_task_drafts" ADD CONSTRAINT "seo_task_drafts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_sop_drafts_digest_id_fkey') THEN
    ALTER TABLE "seo_sop_drafts" ADD CONSTRAINT "seo_sop_drafts_digest_id_fkey" FOREIGN KEY ("digest_id") REFERENCES "seo_digests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_sop_drafts_recommendation_id_fkey') THEN
    ALTER TABLE "seo_sop_drafts" ADD CONSTRAINT "seo_sop_drafts_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "seo_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_client_insights_digest_id_fkey') THEN
    ALTER TABLE "seo_client_insights" ADD CONSTRAINT "seo_client_insights_digest_id_fkey" FOREIGN KEY ("digest_id") REFERENCES "seo_digests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seo_client_insights_client_id_fkey') THEN
    ALTER TABLE "seo_client_insights" ADD CONSTRAINT "seo_client_insights_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
