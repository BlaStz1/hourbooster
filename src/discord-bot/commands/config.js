const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const DiscordAccount = require('../../services/discord-account.service');
const SteamAccount = require('../../services/steam-account.service');
const LicenseCode = require('../../services/license-code.service');
const { encrypt } = require('../../utils/crypto.util');
const switchFn = require('../../utils/switch-function.util');
const { logger } = require('../../helpers/logger.helper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configures the Steam account')
    .addSubcommand((subcommand) =>
      subcommand.setName('games')
        .setDescription('Configure the games to boost for specific Steam account')
        .addStringOption((option) =>
          option.setName('username').setDescription('Steam username').setRequired(true))
        .addStringOption((option) =>
          option.setName('games').setDescription('Separate multiple App IDs with a comma').setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('online-status')
        .setDescription('Configure the online status for specific Steam account')
        .addStringOption((option) =>
          option.setName('username').setDescription('Steam username').setRequired(true))
        .addBooleanOption((option) =>
          option.setName('online').setDescription('Set online status').setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('shared-secret')
        .setDescription('Configure the shared secret for specific Steam account to be used for Steam Guard Authentication')
        .addStringOption((option) =>
          option.setName('username').setDescription('Steam username').setRequired(true))
        .addStringOption((option) =>
          option.setName('shared_secret').setDescription('Steam shared secret'))),
  async execute(interaction) {
    try {
      const discordId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();

      await interaction.deferReply({ ephemeral: true });

      const user = await DiscordAccount.getAccount(discordId);

      if (!user) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('❌ Not Registered')
              .setDescription('You are not registered yet. Use `/user register` to register your account.')
          ]
        });
        return;
      }

      const commands = {
        'games': async () => {
          try {
            const steamUsername = interaction.options.getString('username');
            const games = interaction.options.getString('games');
            const steamAccount = await SteamAccount.getAccount(user.discordId, steamUsername);

            if (!steamAccount) {
              await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Steam Account Not Found')
                    .setDescription(`Steam account \`${steamUsername}\` not found.`)
                ]
              });
              return;
            }

            if (!/^\d+(,\d+)*$/.test(games)) {
              await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('⚠️ Invalid Format')
                    .setDescription('Invalid App IDs format! Valid format: `730,440,570`')
                ]
              });
              return;
            }

            const appIds = games.split(',');
            const numberOfGames = appIds.length;

            const license = await LicenseCode.getCodeById(user.licenseCodeId);

            if (numberOfGames > license.licenseType.maxSteamGames) {
              await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('⚠️ Game Limit Exceeded')
                    .setDescription(`You can only add up to **${license.licenseType.maxSteamGames}** games per Steam account!`)
                ]
              });
              return;
            }

            const uniqueAppIds = [...new Set(appIds)];
            const duplicateAppIds = appIds.filter((item, index) => appIds.indexOf(item) !== index);

            const gamesArray = uniqueAppIds.map(Number);

            if (!gamesArray.every(appId => Number.isInteger(appId) && appId > 0 && appId <= 2147483647)) {
              await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('⚠️ Invalid App ID Range')
                    .setDescription('App ID must be between `1` and `2147483647`.')
                ]
              });
              return;
            }

            await SteamAccount.setGames(steamAccount.username, gamesArray);

            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor('#00cc66')
                  .setTitle('✅ Games Configured')
                  .addFields(
                    { name: 'Steam Account', value: steamUsername, inline: true },
                    { name: 'Games', value: `\`${gamesArray.join(',')}\`` },
                    { name: 'Duplicate App IDs', value: duplicateAppIds.length ? `\`${duplicateAppIds.join(',')}\`` : '`None`' }
                  )
                  .setFooter({ text: 'ℹ️ Start or restart the boost to apply changes.' })
              ]
            });
          } catch (error) {
            logger.error(error?.message ?? error);
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor('#ff0000')
                  .setTitle('❌ Error')
                  .setDescription('Failed to configure games for Steam account.')
              ]
            });
          }
        },
        'online-status': async () => {
          try {
            const steamUsername = interaction.options.getString('username');
            const onlineStatus = interaction.options.getBoolean('online');
            const steamAccount = await SteamAccount.getAccount(user.discordId, steamUsername);

            if (!steamAccount) {
              await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Steam Account Not Found')
                    .setDescription(`Steam account \`${steamUsername}\` not found.`)
                ]
              });
              return;
            }

            await SteamAccount.setOnlineStatus(steamAccount.username, onlineStatus);

            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor('#00cc66')
                  .setTitle('✅ Online Status Updated')
                  .addFields(
                    { name: 'Steam Account', value: steamUsername, inline: true },
                    { name: 'Status', value: onlineStatus ? 'Online' : 'Offline', inline: true }
                  )
                  .setFooter({ text: 'ℹ️ Start or restart the boost to apply changes.' })
              ]
            });
          } catch (error) {
            logger.error(error?.message ?? error);
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor('#ff0000')
                  .setTitle('❌ Error')
                  .setDescription('Failed to configure online status for Steam account.')
              ]
            });
          }
        },
        'shared-secret': async () => {
          try {
            const steamUsername = interaction.options.getString('username');
            const secretRaw = interaction.options.getString('shared_secret');
            const sharedSecret = encrypt(secretRaw);
            const steamAccount = await SteamAccount.getAccount(user.discordId, steamUsername);

            if (!steamAccount) {
              await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Steam Account Not Found')
                    .setDescription(`Steam account \`${steamUsername}\` not found.`)
                ]
              });
              return;
            }

            await SteamAccount.setSharedSecret(steamAccount.username, sharedSecret);

            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor('#00cc66')
                  .setTitle('✅ Shared Secret Updated')
                  .setDescription(`${secretRaw ? 'Set' : 'Removed'} shared secret for **${steamUsername}**.\n\nℹ️ Start or restart the boost to apply changes.`)
              ]
            });
          } catch (error) {
            logger.error(error?.message ?? error);
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor('#ff0000')
                  .setTitle('❌ Error')
                  .setDescription('Failed to configure shared secret for Steam account.')
              ]
            });
          }
        },
      };

      switchFn(commands, 'default')(subcommand);
    } catch (error) {
      logger.error(error);
    }
  },
};
