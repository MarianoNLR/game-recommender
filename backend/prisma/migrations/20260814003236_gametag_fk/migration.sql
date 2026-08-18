-- DropForeignKey
ALTER TABLE "GameTag" DROP CONSTRAINT "GameTag_tagId_fkey";

-- AddForeignKey
ALTER TABLE "GameTag" ADD CONSTRAINT "GameTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("steamTagId") ON DELETE RESTRICT ON UPDATE CASCADE;
