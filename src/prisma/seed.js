const { PrismaClient } = require('@prisma/client');
const environments = require('../environments');
const { LICENSE_TYPE } = require('../constants');
const prisma = new PrismaClient();

const exampleDiscordId = environments.DISCORD_ADMIN_ID;
const exampleLicenseCode = 'AB3D-EF7H';

async function seedLicenseType() {
  const licenseTypeData = [
    {
      id: LICENSE_TYPE.FREE.id,
      name: LICENSE_TYPE.FREE.name,
      maxSteamAccounts: LICENSE_TYPE.FREE.maxSteamAccounts,
      maxSteamGames: LICENSE_TYPE.FREE.maxSteamGames,
    },
    {
      id: LICENSE_TYPE.PREMIUM.id,
      name: LICENSE_TYPE.PREMIUM.name,
      maxSteamAccounts: LICENSE_TYPE.PREMIUM.maxSteamAccounts,
      maxSteamGames: LICENSE_TYPE.PREMIUM.maxSteamGames,
    },
    {
      id: LICENSE_TYPE.ULTRA.id,
      name: LICENSE_TYPE.ULTRA.name,
      maxSteamAccounts: LICENSE_TYPE.ULTRA.maxSteamAccounts,
      maxSteamGames: LICENSE_TYPE.ULTRA.maxSteamGames,
    },
    {
      id: LICENSE_TYPE.FREE2.id,
      name: LICENSE_TYPE.FREE2.name,
      maxSteamAccounts: LICENSE_TYPE.FREE2.maxSteamAccounts,
      maxSteamGames: LICENSE_TYPE.FREE2.maxSteamGames,
    },
  ];

  for (const licenseType of licenseTypeData) {
    await prisma.licenseType.upsert({
      where: { id: licenseType.id },
      update: licenseType,
      create: licenseType,
    });
  }
}

async function seedLicenseCode() {
  await prisma.licenseCodes.upsert({
    where: { code: exampleLicenseCode },
    update: { code: exampleLicenseCode, licenseTypeId: LICENSE_TYPE.FREE.id },
    create: { code: exampleLicenseCode, licenseTypeId: LICENSE_TYPE.FREE.id },
  });
}

async function seedDiscordAccount() {
  await prisma.discordAccounts.upsert({
    where: { discordId: exampleDiscordId },
    update: {},
    create: {
      discordId: exampleDiscordId,
      licenseCode: {
        connect: { code: exampleLicenseCode },
      },
    },
  });

  // Update license status after being used by a user
  await prisma.licenseCodes.update({
    where: { code: exampleLicenseCode },
    data: {
      isUsed: true,
    },
  });
}

async function main() {
  await seedLicenseType();
  // await seedLicenseCode();
  // await seedDiscordAccount();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
