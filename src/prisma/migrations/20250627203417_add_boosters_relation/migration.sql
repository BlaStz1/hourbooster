/*
  Warnings:

  - You are about to drop the `boosted_game` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `boosted_game_user` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "boosted_game";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "boosted_game_user";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "BoostedGame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "appId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "totalBoosted" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BoostedGameUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "boostedGameId" INTEGER NOT NULL,
    CONSTRAINT "BoostedGameUser_boostedGameId_fkey" FOREIGN KEY ("boostedGameId") REFERENCES "BoostedGame" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BoostedGame_appId_key" ON "BoostedGame"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "BoostedGameUser_userId_boostedGameId_key" ON "BoostedGameUser"("userId", "boostedGameId");
