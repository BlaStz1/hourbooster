// dashboard-server.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const http = require('http');
const si = require('systeminformation');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const SteamAccountService = require('./src/services/steam-account.service');
const LicenseCode = require('./src/services/license-code.service');
const SteamBot = require('./src/steam-bot/steam-bot');
const steamBots = require('./src/steam-bot'); // array of running bots
const DiscordAccountService = require('./src/services/discord-account.service');
const { networkInterfaces } = require('os');
const os = require('os');
const axios = require('axios');
const { getAppInfo, imageDir } = require('./src/helpers/appCache.js')

const prisma = new PrismaClient();

const fs = require('fs');
const STATUS_FILE = path.join(__dirname, 'data', 'status.json');

function loadStatus() {
  try {
    const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
    // ensure updates array exists
    if (!Array.isArray(data.updates)) data.updates = [];
    return data;
  } catch (e) {
    return { updates: [] };
  }
}

function saveStatus(data) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
}

function getLocalIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'Unavailable';
}

async function getSystemStats() {
  const [mem, cpu, load, disk, uptime, gpu, net, cpuTempRaw] = await Promise.all([
    si.mem(),
    si.cpu(),
    si.currentLoad(),
    si.fsSize(),
    si.time(),
    si.graphics(),
    si.networkStats(),
    si.cpuTemperature()
  ]);

  const disk0 = disk[0] || {};
  const gpu0 = gpu.controllers?.[0] || {};
  const net0 = net[0] || {};
  const cpuTemp = cpuTempRaw.main || 0;

  return {
    hostname: os.hostname(),
    localIp: getLocalIp(),
    platform: os.platform(),
    arch: os.arch(),
    cpuModel: `${cpu.manufacturer} ${cpu.brand}`,
    cpuCores: cpu.cores,
    cpuUsage: load.currentLoad?.toFixed(1) || '0.0',
    ramTotal: (mem.total / 1073741824).toFixed(1) + ' GB',
    ramUsed: (mem.used / 1073741824).toFixed(1) + ' GB',
    ramUsage: ((mem.used / mem.total) * 100).toFixed(1),
    uptime: Math.floor(uptime.uptime / 3600) + ' hrs',
    diskTotal: disk0.size ? (disk0.size / 1073741824).toFixed(1) + ' GB' : '—',
    diskUsed: disk0.used ? (disk0.used / 1073741824).toFixed(1) + ' GB' : '—',
    diskUsage: disk0.used && disk0.size
      ? ((disk0.used / disk0.size) * 100).toFixed(1)
      : '—',
    cpuTemp: typeof cpuTemp === 'number' ? `${cpuTemp.toFixed(1)}°C` : '—',
    gpuName: gpu0.model || '—',
    gpuTemp: typeof gpu0.temperatureGpu === 'number'
      ? `${gpu0.temperatureGpu.toFixed(1)}°C`
      : '—',
    gpuUsage: typeof gpu0.utilizationGpu === 'number'
      ? `${gpu0.utilizationGpu.toFixed(1)}%`
      : '—',
    networkSpeed:
      typeof net0.tx_sec === 'number' && typeof net0.rx_sec === 'number'
        ? `${(net0.tx_sec / 1024).toFixed(1)} KB/s ↑ ${(net0.rx_sec / 1024).toFixed(1)} KB/s ↓`
        : '—',
    macAddress: net0.mac || '—'
  };
}


  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'changeme';

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'secret-key',
    resave: false,
    saveUninitialized: false
  });
  app.use(sessionMiddleware);

  // Static + auth

  let systemStatus = loadStatus();

app.get('/api/status', (req, res) => {
  res.json(systemStatus);
});
app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard/public/status.html'));
});

app.post('/api/status', (req, res) => {
  if (!req.session?.authenticated) return res.status(403).send('Forbidden');
  const { type, message, title, affects = [], severity = 'low' } = req.body;
  const time = new Date().toISOString();

  const entry = {
    time,
    title: title || '',
    type: type || 'info',
    message,
    severity,                  // ✅ Save severity
    affects,
    resolved: false,
    timeline: []
  };

  systemStatus.updates.unshift(entry);
  if (systemStatus.updates.length > 100) systemStatus.updates.pop();
  saveStatus(systemStatus);
  res.status(200).json({ success: true });
});

app.post('/api/status/update', (req, res) => {
  if (!req.session?.authenticated) return res.status(403).send('Forbidden');
  const { index, title, message, affects, severity } = req.body;
  const time = new Date().toISOString();

  const base = systemStatus.updates[index];
  if (!base) return res.status(400).json({ error: 'Invalid index' });

  if (title) base.title = title;
  if (affects) base.affects = affects;
  if (severity) base.severity = severity; // ✅ Allow updating severity

  if (message) {
    if (!base.timeline) base.timeline = [];
    base.timeline.push({
      time,
      message,
      subtype: 'Update'
    });
  }

  saveStatus(systemStatus);
  return res.json({ success: true });
});


app.post('/api/status/resolve', (req, res) => {
  if (!req.session?.authenticated) return res.status(403).send('Forbidden');
  const { index } = req.body;
  if (typeof systemStatus.updates[index] !== 'undefined') {
    systemStatus.updates[index].resolved = true;
    saveStatus(systemStatus);
    return res.json({ success: true });
  }
  res.status(400).json({ error: 'Invalid index' });
});


app.post('/api/status/delete', (req, res) => {
  if (!req.session?.authenticated) return res.status(403).send('Forbidden');
  const { index } = req.body;
  if (typeof systemStatus.updates[index] === 'undefined') {
    return res.status(400).json({ error: 'Invalid index' });
  }

  systemStatus.updates.splice(index, 1);
  saveStatus(systemStatus);
  return res.json({ success: true });
});




  app.use('/app-cache', express.static(imageDir));
  app.use(express.static(path.join(__dirname, 'dashboard/public')));
  app.get('/', (req, res) => res.redirect('/login'));
  app.get('/login', (req, res) =>
    req.session.authenticated
      ? res.redirect('/dashboard')
      : res.sendFile(path.join(__dirname, 'dashboard/public', 'login.html'))
  );
  app.post('/login', (req, res) => {
    if (req.body.password === DASHBOARD_PASSWORD) {
      req.session.authenticated = true;
      return res.redirect('/dashboard');
    }
    res.redirect('/login');
  });
  app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));
  app.get('/dashboard*', (req, res) => {
    if (req.session.authenticated) {
      res.sendFile(path.join(__dirname, 'dashboard/public', 'dashboard.html'));
    } else {
      res.redirect('/login');
    }
  });
  app.get('/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard/public', 'leaderboard.html'));
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const games = await prisma.boostedGame.findMany({
      include: { boosters: true },              // bring back each game’s boosters[]
      orderBy: { totalBoosted: 'desc' },
      take: 100
    });


    const leaderboard = await Promise.all(
      games.map(async (game) => {
        const { name, imagePath } = await getAppInfo(game.appId); // cached info
        return {
          appId: game.appId,
          name,
          hours: Math.round(game.totalBoosted),
          background: imagePath || null,
          boosters: game.boosters.length
        };
      })
    );

    res.json(leaderboard);
  } catch (err) {
    console.error('[API /leaderboard]', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});


  // Share session with socket.io
  io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

  io.on('connection', socket => {
    if (!socket.request.session.authenticated) return socket.disconnect(true);

    // STATS ASYNC
    socket.emit('stats', async () => ({
      totalUsers: await prisma.discordAccounts.count(),
      totalAccounts: await prisma.steamAccounts.count(),
      boosting: await prisma.steamAccounts.count({ where: { isRunning: true } })
    }));

    socket.on('requestStats', async () => {
      socket.emit('stats', {
        totalUsers: await prisma.discordAccounts.count(),
        totalAccounts: await prisma.steamAccounts.count(),
        boosting: await prisma.steamAccounts.count({ where: { isRunning: true } })
      });
    });
    socket.on('requestSystemStats', async () => {
      try {
        const stats = await getSystemStats();
        socket.emit('systemStats', stats);
      } catch (err) {
        console.error('[systemStats]', err);
      }
    });


    socket.on('requestLicenses', async () => {
      try {
        const allLicenses = await LicenseCode.getAllLicenses();
        socket.emit('licenses', allLicenses);
      } catch (err) {
        logger.error('[requestLicenses]', err);
      }
    });






    // STREAM ACCOUNTS
    socket.emit('accounts', prisma.steamAccounts.findMany());
    socket.on('requestAccounts', async () => {
      socket.emit('accounts', await prisma.steamAccounts.findMany());
    });

    socket.on('toggle-account', async username => {
      const idx = steamBots.findIndex(b => b.getUsername() === username);
      if (idx !== -1) {
        // stop
        const bot = steamBots[idx];
        bot.stop();
        bot.replyDiscord('Stopped via dashboard');
        steamBots.splice(idx, 1);
        await SteamAccountService.setRunningStatus(username, false);
      }
      io.emit('accounts', await prisma.steamAccounts.findMany());
    });

    socket.on('delete-account', async username => {
      const idx = steamBots.findIndex(b => b.getUsername() === username);
      if (idx !== -1) {
        const bot = steamBots[idx];
        bot.stop(true);
        bot.replyDiscord('Removed via dashboard');
        steamBots.splice(idx, 1);
      }
      await SteamAccountService.remove(username);
      io.emit('accounts', await prisma.steamAccounts.findMany());
    });

    // USERS SECTION
    socket.emit('users', prisma.discordAccounts.findMany());
    socket.on('requestUsers', async () => {
      socket.emit('users', await prisma.discordAccounts.findMany());
    });

    socket.on('revoke-user', async discordId => {
      // mark banned
      await DiscordAccountService.ban(discordId);
      // remove their steam accounts
      const theirs = await prisma.steamAccounts.findMany({ where: { discordOwnerId: discordId } });
      for (const a of theirs) {
        await SteamAccountService.remove(a.username);
      }
      io.emit('users', await prisma.discordAccounts.findMany());
      io.emit('accounts', await prisma.steamAccounts.findMany());
    });

    socket.on('delete-user', async discordId => {
      // cascade delete steam
      await prisma.steamAccounts.deleteMany({ where: { discordOwnerId: discordId } });
      // delete user
      await prisma.discordAccounts.delete({ where: { discordId } });
      io.emit('users', await prisma.discordAccounts.findMany());
      io.emit('accounts', await prisma.steamAccounts.findMany());
    });
  });

  server.listen(3001, '0.0.0.0', () => console.log(`Dashboard listening on http://localhost:3001`));
