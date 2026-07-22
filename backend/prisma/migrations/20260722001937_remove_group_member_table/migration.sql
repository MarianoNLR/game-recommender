/*
  Warnings:

  - You are about to drop the `GroupMember` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_groupId_fkey";

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "memberSteamIds" TEXT[];

-- DropTable
DROP TABLE "GroupMember";
