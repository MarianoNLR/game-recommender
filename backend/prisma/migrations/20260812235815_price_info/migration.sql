/*
  Warnings:

  - You are about to alter the column `price` on the `Game` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - Added the required column `isFree` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "initialPrice" INTEGER,
ADD COLUMN     "isFree" BOOLEAN NOT NULL,
ALTER COLUMN "price" SET DATA TYPE INTEGER;
