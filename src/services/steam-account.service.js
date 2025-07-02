const { prisma } = require('./prisma.service');
const { logger } = require('../helpers/logger.helper');
const { appIdsToBytes, bytesToAppIds } = require('../utils/steam.util');
const { tokenToBytes, bytesToToken } = require('../utils/jwt.util');

class SteamAccount {
  static async addIdleHours(username, hours, games = []) {
    if (hours <= 0) return;

    const retries = 3;

    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[addIdleHours] Updating ${username} with ${hours.toFixed(2)} hours`);

        // Update account's total idled time
        const updatedAccount = await prisma.steamAccounts.update({
          where: { username },
          data: { totalHoursIdled: { increment: hours } },
        });

        const steamAccount = await prisma.steamAccounts.findUnique({
          where: { username }
        });

        for (const appId of games) {
          const name = `App ${appId}`;

          const boostedGame = await prisma.boostedGame.upsert({
            where: { appId },
            update: {
              totalBoosted: { increment: hours },
              updatedAt: new Date(),
            },
            create: {
              appId,
              name,
              totalBoosted: hours,
            },
          });

          await prisma.boostedGameUser.upsert({
            where: {
              steamAccountId_boostedGameId: {
                steamAccountId: steamAccount.id,
                boostedGameId: boostedGame.id,
              },
            },
            update: {},
            create: {
              steamAccount: { connect: { id: steamAccount.id } },
              boostedGame: { connect: { id: boostedGame.id } },
            },
          });
        }

        return updatedAccount;
      } catch (err) {
        console.error(`[addIdleHours] Error updating ${username}:`, err);
        if (i === retries - 1) throw err;
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }

  static async getGlobalIdleHours() {
    const { _sum } = await prisma.steamAccounts.aggregate({
      _sum: { totalHoursIdled: true },
    });
    return _sum.totalHoursIdled ?? 0;
  }

  static async getTotalSteamAccounts() {
    return prisma.steamAccounts.count();
  }

  static async insert({ username, password, sharedSecret, refreshToken, games, discordOwnerId }) {
    try {
      return await prisma.steamAccounts.create({
        data: {
          username,
          password,
          sharedSecret,
          refreshToken: tokenToBytes(refreshToken),
          games: appIdsToBytes(games),
          discordOwner: {
            connect: { discordId: discordOwnerId },
          },
        },
      });
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to insert new Steam account to database');
    }
  }

  static async remove(steamUsername) {
    try {
      return await prisma.steamAccounts.delete({
        where: { username: steamUsername },
      });
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to remove Steam account from database');
    }
  }

  static async getAll(discordId) {
    try {
      const steamAccounts = await prisma.steamAccounts.findMany({
        where: {
          discordOwner: {
            discordId,
          },
        },
      });

      return steamAccounts.map((steamAccount) => ({
        ...steamAccount,
        refreshToken: bytesToToken(steamAccount.refreshToken),
        games: bytesToAppIds(steamAccount.games),
      }));
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to get Steam accounts from database');
    }
  }

  static async getAllRunning() {
    try {
      const steamAccounts = await prisma.steamAccounts.findMany({
        where: { isRunning: true },
      });

      return steamAccounts.map((steamAccount) => ({
        ...steamAccount,
        refreshToken: bytesToToken(steamAccount.refreshToken),
        games: bytesToAppIds(steamAccount.games),
      }));
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to get all running Steam accounts from database');
    }
  }

  static async getAccount(discordId, steamUsername) {
    try {
      const steamAccount = await prisma.steamAccounts.findFirst({
        where: {
          username: steamUsername,
          discordOwner: {
            discordId,
          },
        },
      });

      if (!steamAccount) {
        return null;
      }

      return {
        ...steamAccount,
        refreshToken: bytesToToken(steamAccount.refreshToken),
        games: bytesToAppIds(steamAccount.games),
      };
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to get Steam account from database');
    }
  }

  static async setRunningStatus(steamUsername, isRunning) {
    try {
      return await prisma.steamAccounts.update({
        where: { username: steamUsername },
        data: { isRunning },
      });
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to set running status for Steam account in database');
    }
  }

static async setGames(steamUsername, games) {
  try {
    const updated = await prisma.steamAccounts.update({
      where: { username: steamUsername },
      data: { games: appIdsToBytes(games) }, // optional, only if you're still using this field
    });

    const steamAccountId = updated.id;

    // 1. Get all current boosts for this account
    const existing = await prisma.boostedGameUser.findMany({
      where: { steamAccountId },
      include: { boostedGame: true }
    });

    const existingAppIds = new Set(existing.map(b => b.boostedGame.appId));
    const newAppIds = new Set(games);

    // 2. Add missing links
    for (const appId of newAppIds) {
      let boostedGame = await prisma.boostedGame.findUnique({ where: { appId } });

      if (!boostedGame) {
        boostedGame = await prisma.boostedGame.create({
          data: {
            appId,
            name: `App ${appId}`,
          }
        });
      }

      await prisma.boostedGameUser.upsert({
        where: {
          steamAccountId_boostedGameId: {
            steamAccountId,
            boostedGameId: boostedGame.id
          }
        },
        update: {},
        create: {
          steamAccount: { connect: { id: steamAccountId } },
          boostedGame: { connect: { id: boostedGame.id } },
        }
      });
    }

    // 3. Remove any no-longer-used boosts
    for (const record of existing) {
      if (!newAppIds.has(record.boostedGame.appId)) {
        await prisma.boostedGameUser.delete({
          where: {
            steamAccountId_boostedGameId: {
              steamAccountId,
              boostedGameId: record.boostedGameId
            }
          }
        });
      }
    }

    return updated;
  } catch (error) {
    logger.error(error);
    throw new Error('Failed to set games for Steam account in database');
  }
}


  static async setOnlineStatus(steamUsername, onlineStatus) {
    try {
      return await prisma.steamAccounts.update({
        where: { username: steamUsername },
        data: { onlineStatus },
      });
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to set online status for Steam account in database');
    }
  }

  static async setSharedSecret(steamUsername, sharedSecret) {
    try {
      return await prisma.steamAccounts.update({
        where: { username: steamUsername },
        data: { sharedSecret },
      });
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to set shared secret for Steam account in database');
    }
  }

  static async setRefreshToken(steamUsername, refreshToken) {
    try {
      return await prisma.steamAccounts.update({
        where: { username: steamUsername },
        data: { refreshToken: tokenToBytes(refreshToken) },
      });
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to set refresh token for Steam account in database');
    }
  }
}

module.exports = SteamAccount;
