/*
  Warnings:

  - You are about to drop the `GameTags` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "GameTags";

-- CreateTable
CREATE TABLE "Game" (
    "appId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "price" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("appId")
);
