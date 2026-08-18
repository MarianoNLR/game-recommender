/*
  Warnings:

  - You are about to drop the column `details` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `headerImageUrl` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Game" DROP COLUMN "details",
DROP COLUMN "headerImageUrl",
ADD COLUMN     "reviewPercentage" INTEGER;
