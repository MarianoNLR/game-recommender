/*
  Warnings:

  - You are about to drop the column `lastPicsUpdate` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `lastPriceUpdate` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `lastTagsUpdate` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Game" DROP COLUMN "lastPicsUpdate",
DROP COLUMN "lastPriceUpdate",
DROP COLUMN "lastTagsUpdate";
