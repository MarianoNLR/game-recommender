/*
  Warnings:

  - Added the required column `weight` to the `GameTag` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GameTag" ADD COLUMN     "weight" INTEGER NOT NULL;
