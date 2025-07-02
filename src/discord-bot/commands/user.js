const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const DiscordAccount = require('../../services/discord-account.service');
const LicenseCode = require('../../services/license-code.service');
const switchFn = require('../../utils/switch-function.util');
const { logger } = require('../../helpers/logger.helper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('User management')
    .addSubcommand((subcommand) =>
      subcommand.setName('info')
        .setDescription('View user info'))
    .addSubcommand((subcommand) =>
      subcommand.setName('register')
        .setDescription('Register your Discord account using license key')
        .addStringOption((option) => option.setName('key').setDescription('License key to register').setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('change-license')
        .setDescription('Change existing license key')
        .addStringOption((option) => option.setName('key').setDescription('Your new license key').setRequired(true))),
  async execute(interaction) {
    try {
      const discordId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();

      await interaction.deferReply({ ephemeral: true });

      const commands = {
        'info': async () => {
          try {
            const user = await DiscordAccount.getAccount(discordId);

            if (!user) {
              await interaction.editReply('You are not registered yet. Use `/user register` to register your account.');
              return;
            }

            const license = await LicenseCode.getCodeById(user.licenseCodeId);

            const userInfoEmbed = new EmbedBuilder()
              .setColor(0x0099FF)
              .setTitle('User Info')
              .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
              .setDescription('Your account info')
              .addFields(
                { name: 'Discord ID', value: discordId, inline: true },
                { name: 'License key', value: license.code, inline: true },
                { name: 'License type', value: license.licenseType.name, inline: true },
                { name: 'Limit (Steam Accounts/Steam Games)', value: `(${license.licenseType.maxSteamAccounts}/${license.licenseType.maxSteamGames})`, inline: true },
              )
              .setTimestamp();

            await interaction.editReply({ embeds: [userInfoEmbed] });
          } catch (error) {
            logger.error(error?.message ?? error);
            await interaction.editReply('Failed to get user info.');
          }
        },
        'register': async () => {
          try {
            const key = interaction.options.getString('key');
            const user = await DiscordAccount.getAccount(discordId);

            if (user) {
              await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ffd700")
                    .setTitle('⚠️ User Already Registered')
                    .setDescription(`You are already registered with license key \`${user.licenseCodeId}\`. Use \`/user change-license\` to change your license key.`)
                ]
              });
              return;
            }

            const licenseKey = await LicenseCode.getCode(key);

            if (!licenseKey || licenseKey?.isUsed) {
              await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ffd700")
                    .setTitle('⚠️ License Key Invalid')
                    .setDescription(`License key \`${key}\` is invalid or already used.`)
                ]
              });
              return;
            }

            await DiscordAccount.insert(discordId, key);
            await LicenseCode.updateCodeStatus(key, true);

            const successEmbed = new EmbedBuilder()
              .setColor(0x00FF00)
              .setTitle('Registration Successful')
              .setDescription(`Your Discord account has been successfully registered with license key \`${key}\`.`);

            await interaction.editReply({ embeds: [successEmbed] });
          } catch (error) {
            logger.error(error?.message ?? error);
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#ff0000")
                  .setTitle('⚠️ Error')
                  .setDescription('Failed to register your account. Please try again later.')
              ]
            });
          }
        },
        'change-license': async () => {
          try {
            const key = interaction.options.getString('key');
            const user = await DiscordAccount.getAccount(discordId);

            if (!user) {
              await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ffd700")
                    .setTitle('⚠️ User Not Registered')
                    .setDescription(`You need to register your Discord account first using \`/user register\`.`)
                ]
              });
              return;
            }

            const licenseKey = await LicenseCode.getCode(key);

            if (!licenseKey || licenseKey?.isUsed) {
              await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ffd700")
                    .setTitle('⚠️ License Key Invalid')
                    .setDescription(`License key \`${key}\` is invalid or already used.`)
                ]
              });
              return;
            }

            await DiscordAccount.updateLicenseCode(discordId, key);
            await LicenseCode.updateCodeStatus(key, true);

            const successEmbed = new EmbedBuilder()
              .setColor(0x00FF00)
              .setTitle('License Key Changed')
              .setDescription(`Your license key has been successfully changed to \`${key}\`.`)
              .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });
          } catch (error) {
            logger.error(error?.message ?? error);
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#ff0000")
                  .setTitle('⚠️ Error')
                  .setDescription('Failed to change your license key. Please try again later.')
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
