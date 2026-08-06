-- CreateTable
CREATE TABLE "Group" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdFromIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "memberSteamIds" TEXT[],

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "appId" INTEGER NOT NULL,
    "steamAppId" INTEGER,
    "name" TEXT,
    "tags" JSONB,
    "price" INTEGER,
    "details" JSONB,
    "tagsFetched" BOOLEAN NOT NULL DEFAULT false,
    "detailsFetched" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("appId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_accessCode_key" ON "Group"("accessCode");

-- CreateIndex
CREATE UNIQUE INDEX "Game_steamAppId_key" ON "Game"("steamAppId");
