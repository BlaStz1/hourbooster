const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const SteamAccount = require('../../services/steam-account.service');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows all available commands'),
  async execute(interaction) {
    try {
      await interaction.deferReply();

      // Fetch both stats
      const [globalHours, totalSteamAccounts] = await Promise.all([
        SteamAccount.getGlobalIdleHours(),
        SteamAccount.getTotalSteamAccounts()
      ]);

      const rawHours       = globalHours ?? 0;
      const roundedHours   = Math.round(rawHours);
      const formattedHours = roundedHours.toLocaleString();

      const helpEmbed = new EmbedBuilder()
        .setColor('#DC2626')
        .setTitle(`Hour Booster Commands`)
        .setDescription(`**Thank you for checking out Hour Booster!**\n-# We are still in development, please report any bugs or issues you come across. (https://discord.gg/Qt4vT3Enc8)`)
        .addFields(
          { name: 'Idling Control',  value: '`/boost`',  inline: true },
          { name: 'User Commands',   value: '`/user`',   inline: true },
          { name: 'Configuration',   value: '`/config`', inline: true },
          { name: '\u200B',          value: '**Global Stats Below**',    inline: false }, // spacer
          {
            name: '🌐 Total Hours Idled',
            value: `We've idled \`${formattedHours} Hours\` so far across all accounts!`,
            inline: true
          },
          {
            name: '🧍 Total Steam Accounts',
            value: `There's a total of \`${totalSteamAccounts.toLocaleString()}\` steam accounts registered.`,
            inline: true
          }
        );

      await interaction.editReply({ embeds: [helpEmbed] });
    } catch (error) {
      logger.error(error);
      await interaction.editReply('Failed to show help.');
    }
  },
};
