// src/discord-bot/index.js
require('../startup/logging')();

const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const environments = require('../environments');

const TOKEN = environments.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.functions = {
  sendDM: (userId, message) => client.users.send(userId, message),
};

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  client.commands.set(command.data.name, command);
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.once('ready', () => {
  console.log(`Discord bot ready as ${client.user.tag}`);
});

client.login(TOKEN);

module.exports = { client };
