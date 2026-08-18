/*
  Warnings:

  - The primary key for the `Game` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Game` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "GameTag" DROP CONSTRAINT "GameTag_gameId_fkey";

-- DropIndex
DROP INDEX "Game_steamAppId_key";

-- AlterTable
ALTER TABLE "Game" DROP CONSTRAINT "Game_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Game_pkey" PRIMARY KEY ("steamAppId");

-- AddForeignKey
ALTER TABLE "GameTag" ADD CONSTRAINT "GameTag_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("steamAppId") ON DELETE RESTRICT ON UPDATE CASCADE;
