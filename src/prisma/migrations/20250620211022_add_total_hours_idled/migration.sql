-- CreateTable
CREATE TABLE "discord_accounts" (
    "discordId" TEXT NOT NULL PRIMARY KEY,
    "licenseCodeId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "discord_accounts_licenseCodeId_fkey" FOREIGN KEY ("licenseCodeId") REFERENCES "license_codes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "steam_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordOwnerId" TEXT NOT NULL,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "sharedSecret" TEXT NOT NULL,
    "refreshToken" BLOB NOT NULL,
    "onlineStatus" BOOLEAN NOT NULL DEFAULT true,
    "games" BLOB NOT NULL,
    "totalHoursIdled" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "steam_accounts_discordOwnerId_fkey" FOREIGN KEY ("discordOwnerId") REFERENCES "discord_accounts" ("discordId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "license_type" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "maxSteamAccounts" INTEGER NOT NULL,
    "maxSteamGames" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "license_codes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "licenseTypeId" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "license_codes_licenseTypeId_fkey" FOREIGN KEY ("licenseTypeId") REFERENCES "license_type" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "discord_accounts_licenseCodeId_key" ON "discord_accounts"("licenseCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "steam_accounts_username_key" ON "steam_accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "license_type_name_key" ON "license_type"("name");

-- CreateIndex
CREATE UNIQUE INDEX "license_codes_code_key" ON "license_codes"("code");
