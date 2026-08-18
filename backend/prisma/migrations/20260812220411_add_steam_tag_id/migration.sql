/*
  Warnings:

  - A unique constraint covering the columns `[steamTagId]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "steamTagId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_steamTagId_key" ON "Tag"("steamTagId");
