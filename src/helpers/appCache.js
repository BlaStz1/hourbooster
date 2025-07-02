const fs = require('fs');
const path = require('path');
const axios = require('axios');

const cacheDir = path.resolve(__dirname, '../../data/app_cache');
const cacheFile = path.join(cacheDir, 'apps.json');
const imageDir = path.join(cacheDir, 'images');

// Ensure directories exist
fs.mkdirSync(imageDir, { recursive: true });

// Load cache from disk
let appCache = {};
function loadCache() {
  if (fs.existsSync(cacheFile)) {
    try {
      const raw = fs.readFileSync(cacheFile, 'utf-8');
      appCache = JSON.parse(raw);
    } catch (err) {
      console.error('[appCache] Failed to parse cache file, resetting:', err);
      appCache = {};
    }
  }
  return appCache;
}

// Save cache metadata (not image files)
function saveCache() {
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(appCache, null, 2));
  } catch (err) {
    console.error('[appCache] Failed to write cache:', err);
  }
}

// Download image to disk if not already saved
async function downloadImage(appId) {
  const url = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_184x69.jpg`;
  const filePath = path.join(imageDir, `${appId}.jpg`);

  if (fs.existsSync(filePath)) return filePath;

  try {
    const res = await axios.get(url, { responseType: 'stream' });
    const writer = fs.createWriteStream(filePath);

    await new Promise((resolve, reject) => {
      res.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return filePath;
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn(`[appCache] No background for ${appId} (404 Not Found)`);
    } else {
      console.warn(`[appCache] Failed to download image for ${appId}:`, err.message);
    }
    return null;
  }
}

// Fetch or return cached app info
async function getAppInfo(appId) {
  appId = String(appId);

  // Always reload cache fresh from disk
  loadCache();

  if (appCache[appId]) return appCache[appId];

  try {
    const { data } = await axios.get('https://store.steampowered.com/api/appdetails', {
      params: { appids: appId },
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
        'Referer': 'https://store.steampowered.com/',
      },
      timeout: 5000
    });

    const entry = data?.[appId];
    const fallback = `App ${appId}`;
    const imagePath = await downloadImage(appId);

    const cached = {
      name: entry?.success && entry.data?.name ? entry.data.name : fallback,
      imagePath: imagePath ? `/app-cache/${appId}.jpg` : null
    };

    appCache[appId] = cached;
    saveCache();
    return cached;
  } catch (err) {
    console.warn(`[appCache] Failed to fetch appId ${appId}:`, err?.response?.status || err.message);

    const fallback = {
      name: `App ${appId}`,
      imagePath: null
    };

    appCache[appId] = fallback;
    saveCache();
    return fallback;
  }
}




module.exports = {
  getAppInfo,
  loadCache,
  saveCache,
  _cache: appCache,
  imageDir
};
