-- AlterTable
ALTER TABLE "users" ADD COLUMN "has_seen_welcome" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "guide_completions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guide_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guide_completions_user_id_idx" ON "guide_completions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "guide_completions_user_id_guide_id_key" ON "guide_completions"("user_id", "guide_id");

-- AddForeignKey
ALTER TABLE "guide_completions" ADD CONSTRAINT "guide_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
