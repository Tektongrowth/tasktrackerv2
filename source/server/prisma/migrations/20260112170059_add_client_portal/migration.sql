-- CreateTable
CREATE TABLE "client_access_tokens" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_viewers" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_viewers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_access_tokens_token_key" ON "client_access_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "client_viewers_client_id_email_key" ON "client_viewers"("client_id", "email");

-- AddForeignKey
ALTER TABLE "client_access_tokens" ADD CONSTRAINT "client_access_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_viewers" ADD CONSTRAINT "client_viewers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
