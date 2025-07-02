const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder } = require('discord.js');
const steamBots = require('../../steam-bot');
const SteamBot = require('../../steam-bot/steam-bot');
const SteamAccount = require('../../services/steam-account.service');
const DiscordAccount = require('../../services/discord-account.service');
const LicenseCode = require('../../services/license-code.service');
const { encrypt } = require('../../utils/crypto.util');
const { MAX_STEAM_USERNAME_LENGTH, MAX_STEAM_PASSWORD_LENGTH } = require('../../constants');
const { logger } = require('../../helpers/logger.helper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boost')
    .setDescription('Boosts a Steam account')
    .addSubcommand((subcommand) =>
      subcommand.setName('add')
        .setDescription('Add new Steam account to boost')
        .addStringOption((option) => option.setName('username').setDescription('Steam username').setRequired(true))
        .addStringOption((option) => option.setName('password').setDescription('Steam password').setRequired(true))
        .addStringOption((option) => option.setName('shared_secret').setDescription('Steam shared secret')))
    .addSubcommand((subcommand) =>
      subcommand.setName('list')
        .setDescription('List all available Steam accounts'))
    .addSubcommand((subcommand) =>
      subcommand.setName('steam-guard')
        .setDescription('Set Steam Guard code for specific Steam account')
        .addStringOption((option) => option.setName('username').setDescription('Steam username').setRequired(true))
        .addStringOption((option) => option.setName('code').setDescription('Steam Guard code').setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('start')
        .setDescription('Start boosting specific Steam account')
        .addStringOption((option) => option.setName('username').setDescription('Steam username').setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('restart')
        .setDescription('Restart boosting (include username to restart specific account).')
        .addStringOption((option) => option.setName('username').setDescription('Steam username')))
    .addSubcommand((subcommand) =>
      subcommand.setName('stop')
        .setDescription('Stop boosting specific Steam account')
        .addStringOption((option) => option.setName('username').setDescription('Steam username').setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('remove')
        .setDescription('Remove specific Steam account')
        .addStringOption((option) => option.setName('username').setDescription('Steam username').setRequired(true)))
        .addSubcommand((subcommand) =>
      subcommand.setName('games')
        .setDescription('List top games of a Steam account')
        .addStringOption((option) =>
          option.setName('username')
            .setDescription('Steam username')
            .setRequired(true)
        )
    ),

        

  async execute(interaction) {
    const discordId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    await interaction.deferReply({ ephemeral: true });

    const user = await DiscordAccount.getAccount(discordId);
    if (!user) return interaction.editReply({ content: 'You are not registered yet. Use `/user register` to register your account.', ephemeral: true });

    const errorEmbed = (message) => new EmbedBuilder().setColor('Red').setDescription(`❌ ${message}`);
    const successEmbed = (message) => new EmbedBuilder().setColor('Green').setDescription(`✅ ${message}`);

    try {
      switch (subcommand) {
        case 'add': {
          const license = await LicenseCode.getCodeById(user.licenseCodeId);
          const steamAccounts = await SteamAccount.getAll(discordId);
          const username = interaction.options.getString('username');
          const password = interaction.options.getString('password');
          const sharedSecret = interaction.options.getString('shared_secret') || '';

          if (username.length > MAX_STEAM_USERNAME_LENGTH) return interaction.editReply({ embeds: [errorEmbed(`Steam username is too long. (Max: ${MAX_STEAM_USERNAME_LENGTH})`)] });
          if (password.length > MAX_STEAM_PASSWORD_LENGTH) return interaction.editReply({ embeds: [errorEmbed(`Steam password is too long. (Max: ${MAX_STEAM_PASSWORD_LENGTH})`)] });
          if (steamAccounts.length >= license.licenseType.maxSteamAccounts) return interaction.editReply({ embeds: [errorEmbed(`Maximum Steam accounts reached. (Max: ${license.licenseType.maxSteamAccounts})`)] });
          if (await SteamAccount.getAccount(discordId, username)) return interaction.editReply({ embeds: [errorEmbed(`Steam account \`${username}\` already exists.`)] });

          await SteamAccount.insert({
            username,
            password: encrypt(password),
            sharedSecret: encrypt(sharedSecret),
            refreshToken: '',
            games: [],
            discordOwnerId: discordId,
          });

          return interaction.editReply({ embeds: [successEmbed(`Successfully added new Steam account: \`${username}\``)] });
        }

case 'list': {
  const steamAccounts = await SteamAccount.getAll(discordId);
  if (!steamAccounts.length) {
    return interaction.editReply({ embeds: [errorEmbed('No Steam accounts found.')] });
  }

  // Helpers
  const makeEmbed = (idx) => {
    const acc = steamAccounts[idx];
    return new EmbedBuilder()
      .setColor('Blurple')
      .setTitle(`Steam Account #${idx + 1}`)
      .addFields(
        { name: 'Username', value: acc.username, inline: true },
        { name: 'Boost Status', value: acc.isRunning ? '🟢 Running' : '🔴 Stopped', inline: true },
        { name: 'Online Status', value: acc.onlineStatus ? '🟢 Online' : '⚫ Invisible', inline: true },
        { name: 'Games',       value: acc.games.length ? acc.games.join(', ') : 'None' }
      );
  };

  const makeSelect = (currentIdx) =>
    new StringSelectMenuBuilder()
      .setCustomId('select_account')
      .setPlaceholder('Select a Steam account')
      .setOptions(
        steamAccounts.map((acc, idx) => ({
          label: acc.username,
          value: String(idx),
          default: idx === currentIdx
        }))
      );

  let currentPage = 0;
  const embed = makeEmbed(currentPage);

  // First row: pagination
  const rowPagination = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('first').setLabel('<<').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('prev').setLabel('<').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('next').setLabel('>').setStyle(ButtonStyle.Secondary).setDisabled(steamAccounts.length <= 1),
    new ButtonBuilder().setCustomId('last').setLabel('>>').setStyle(ButtonStyle.Secondary).setDisabled(steamAccounts.length <= 1)
  );

  // Second row: remove & toggle
  const makeActionRow = (running) => new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('remove_acc')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('toggle_acc')
      .setEmoji(running ? '⏸️' : '▶️')
      .setStyle(running ? ButtonStyle.Secondary : ButtonStyle.Success)
  );

  const rowSelect  = new ActionRowBuilder().addComponents(makeSelect(currentPage));
  let rowActions   = makeActionRow(steamAccounts[currentPage].isRunning);

  // Send initial reply
  const msg = await interaction.editReply({
    embeds: [embed],
    components: [rowSelect, rowPagination, rowActions],
    fetchReply: true
  });

  const collector       = msg.createMessageComponentCollector({ time: 60_000 });
  const selectCollector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60_000 });

  // Re-render everything
  const updateView = async () => {
    // Refresh data for current account
    const fresh = await SteamAccount.getAccount(discordId, steamAccounts[currentPage].username);
    steamAccounts[currentPage] = fresh;

    // Rebuild embed/select/buttons
    const newEmbed      = makeEmbed(currentPage);
    const newSelect     = makeSelect(currentPage);
    rowPagination.components[0].setDisabled(currentPage === 0);
    rowPagination.components[1].setDisabled(currentPage === 0);
    rowPagination.components[2].setDisabled(currentPage === steamAccounts.length - 1);
    rowPagination.components[3].setDisabled(currentPage === steamAccounts.length - 1);
    rowActions         = makeActionRow(steamAccounts[currentPage].isRunning);

    await interaction.editReply({
      embeds: [newEmbed],
      components: [new ActionRowBuilder().addComponents(newSelect), rowPagination, rowActions]
    });
  };

  collector.on('collect', async (i) => {
    if (i.user.id !== discordId) return i.reply({ content: 'Not for you.', ephemeral: true });
    await i.deferUpdate();

    switch (i.customId) {
      case 'first':  currentPage = 0; break;
      case 'prev':   if (currentPage > 0) currentPage--; break;
      case 'next':   if (currentPage < steamAccounts.length - 1) currentPage++; break;
      case 'last':   currentPage = steamAccounts.length - 1; break;
      case 'remove_acc': {
        const username = steamAccounts[currentPage].username;
        const idx = steamBots.findIndex(b => b.getUsername() === username);
        if (idx !== -1) { steamBots[idx].stop(true); steamBots.splice(idx,1); }
        await SteamAccount.remove(username);
        steamAccounts.splice(currentPage, 1);
        if (currentPage >= steamAccounts.length) currentPage = steamAccounts.length - 1;
        if (!steamAccounts.length) {
          return interaction.editReply({ embeds: [errorEmbed('All accounts removed.')], components: [] });
        }
        break;
      }
      case 'toggle_acc': {
        const acc = steamAccounts[currentPage];
        const bot = steamBots.find(b => b.getUsername() === acc.username);
        if (bot && bot.isRunning()) {
          bot.stop();
        } else {
          const newBot = bot || new SteamBot(acc, interaction.client);
          if (!bot) steamBots.push(newBot);
          newBot.start();
        }
        // flip local state for button icon
        steamAccounts[currentPage].isRunning = !(bot && bot.isRunning());
        break;
      }
    }

    await updateView();
  });

  selectCollector.on('collect', async (sel) => {
    if (sel.user.id !== discordId) return sel.reply({ content: 'Not for you.', ephemeral: true });
    await sel.deferUpdate();
    currentPage = parseInt(sel.values[0], 10);
    await updateView();
  });

  collector.on('end',     () => interaction.editReply({ components: [] }));
  selectCollector.on('end',() => interaction.editReply({ components: [] }));

  break;
}




        case 'steam-guard': {
          const username = interaction.options.getString('username');
          const code = interaction.options.getString('code');
          const steamAccount = await SteamAccount.getAccount(discordId, username);
          if (!steamAccount) return interaction.editReply({ embeds: [errorEmbed(`Steam account \`${username}\` not found.`)] });
          const steamBot = steamBots.find((bot) => bot.getUsername() === username);
          if (!steamBot || !steamBot.getSteamGuardAuth()) return interaction.editReply({ embeds: [errorEmbed(`Steam account \`${username}\` does not require a Steam Guard code.`)] });
          steamBot.inputSteamGuardCode(code);
          return interaction.editReply({ embeds: [successEmbed(`Steam Guard code set for \`${username}\`.`)] });
        }

        case 'start': {
          const username = interaction.options.getString('username');
          const account = await SteamAccount.getAccount(discordId, username);
          if (!account) return interaction.editReply({ embeds: [errorEmbed(`Steam account \`${username}\` not found.`)] });
          if (steamBots.find((bot) => bot.getUsername() === account.username)?.isRunning()) return interaction.editReply({ embeds: [errorEmbed(`Steam account \`${username}\` is already boosting.`)] });

          const bot = new SteamBot(account, interaction.client);
          bot.setOnlineStatus(account.onlineStatus);
          bot.setGames(account.games);
          bot.setSharedSecret(account.sharedSecret, false);
          steamBots.push(bot);
          bot.start();

          return interaction.editReply({ embeds: [successEmbed(`Started boosting for \`${username}\`.`)] });
        }

        case 'restart': {
          const username = interaction.options.getString('username');
          const accounts = username ? [await SteamAccount.getAccount(discordId, username)] : await SteamAccount.getAll(discordId);
          if (!accounts.length || !accounts[0]) return interaction.editReply({ embeds: [errorEmbed('No valid accounts found.')] });

          let count = 0;
          for (const acc of accounts) {
            const bot = steamBots.find((b) => b.getUsername() === acc.username && (b.isRunning() || acc.isRunning));
            if (!bot) continue;
            bot.setOnlineStatus(acc.onlineStatus);
            bot.setGames(acc.games);
            bot.setSharedSecret(acc.sharedSecret, false);
            bot.restart();
            count++;
          }

          return interaction.editReply({ embeds: [successEmbed(`Restarted \`${count}\` account(s).`)] });
        }

        case 'stop': {
          const username = interaction.options.getString('username');
          const account = await SteamAccount.getAccount(discordId, username);
          if (!account) return interaction.editReply({ embeds: [errorEmbed(`Steam account \`${username}\` not found.`)] });
          const bot = steamBots.find((b) => b.getUsername() === account.username && (b.isRunning() || account.isRunning));
          if (!bot) return interaction.editReply({ embeds: [errorEmbed(`Steam account \`${username}\` is not being boosted.`)] });
          bot.stop();
          return interaction.editReply({ embeds: [successEmbed(`Stopped boosting for \`${username}\`.`)] });
        }

        case 'remove': {
          const username = interaction.options.getString('username');
          const account = await SteamAccount.getAccount(discordId, username);
          if (!account) return interaction.editReply({ embeds: [errorEmbed(`Steam account \`${username}\` not found.`)] });
          const botIndex = steamBots.findIndex((b) => b.getUsername() === account.username);
          if (botIndex !== -1) {
            steamBots[botIndex].stop(true);
            steamBots.splice(botIndex, 1);
          }
          await SteamAccount.remove(username);
          return interaction.editReply({ embeds: [successEmbed(`Removed Steam account \`${username}\`.`)] });
        }


      }
    } catch (error) {
      logger.error(error);
      return interaction.editReply({ embeds: [errorEmbed('An unexpected error occurred.')] });
    }
  },
};