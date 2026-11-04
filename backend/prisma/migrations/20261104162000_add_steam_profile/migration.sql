-- CreateTable
CREATE TABLE "SteamProfile" (
    "steamId" TEXT NOT NULL,
    "personaName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "games" JSONB NOT NULL,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SteamProfile_pkey" PRIMARY KEY ("steamId")
);
