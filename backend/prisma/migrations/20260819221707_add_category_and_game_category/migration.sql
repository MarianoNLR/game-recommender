-- CreateTable
CREATE TABLE "Category" (
    "steamCategoryId" INTEGER NOT NULL,
    "internalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("steamCategoryId")
);

-- CreateTable
CREATE TABLE "GameCategory" (
    "steamAppId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "GameCategory_pkey" PRIMARY KEY ("steamAppId","categoryId")
);

-- AddForeignKey
ALTER TABLE "GameCategory" ADD CONSTRAINT "GameCategory_steamAppId_fkey" FOREIGN KEY ("steamAppId") REFERENCES "Game"("steamAppId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCategory" ADD CONSTRAINT "GameCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("steamCategoryId") ON DELETE RESTRICT ON UPDATE CASCADE;
