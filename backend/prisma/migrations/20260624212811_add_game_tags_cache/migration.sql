-- CreateTable
CREATE TABLE "GameTags" (
    "appId" INTEGER NOT NULL,
    "tags" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameTags_pkey" PRIMARY KEY ("appId")
);
