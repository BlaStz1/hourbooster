-- CreateTable
CREATE TABLE "boosted_game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "totalBoosted" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "boosted_game_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    CONSTRAINT "boosted_game_user_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "boosted_game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "boosted_game_user_discordId_gameId_key" ON "boosted_game_user"("discordId", "gameId");
