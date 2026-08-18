/*
  Warnings:

  - The primary key for the `Game` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `appId` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `detailsFetched` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `fetchedAt` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `tagsFetched` on the `Game` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[steamAppId]` on the table `Game` will be added. If there are existing duplicate values, this will fail.
  - Made the column `steamAppId` on table `Game` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `Game` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Game" DROP CONSTRAINT "Game_pkey",
DROP COLUMN "appId",
DROP COLUMN "detailsFetched",
DROP COLUMN "fetchedAt",
DROP COLUMN "tags",
DROP COLUMN "tagsFetched",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "discount" INTEGER,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "lastInfoUpdate" TIMESTAMP(3),
ADD COLUMN     "lastPriceUpdate" TIMESTAMP(3),
ADD COLUMN     "releaseDate" TIMESTAMP(3),
ALTER COLUMN "steamAppId" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION,
ADD CONSTRAINT "Game_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameTag" (
    "gameId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "GameTag_pkey" PRIMARY KEY ("gameId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Game_steamAppId_key" ON "Game"("steamAppId");

-- AddForeignKey
ALTER TABLE "GameTag" ADD CONSTRAINT "GameTag_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTag" ADD CONSTRAINT "GameTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
