/*
   𝑸𝒖𝒆𝒆𝒏 𝒁𝒂𝒓𝒂 𝑴𝒊𝒏𝒊 - WhatsApp Multi-Device Bot
   Owner           : FIXO DEV (94703945265)
   Baileys         : fixo-baileys
   Version         : 3.5.3 (Presence + Channel fixes + Auto React + Full Code)
*/

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  proto,
  downloadContentFromMessage,
  jidDecode,
  fetchLatestBaileysVersion,
  Browsers
} = require('fixo-baileys')

const { getBuffer, getGroupAdmins } = require('./lib/functions')
const { saveMessage } = require('./data')
const { initializeAntiDeleteSettings, setAnti, getAnti } = require('./lib')
const { AntiViewOnce } = require('./lib/antivv')
const fs = require('fs')
const P = require('pino')
const config = require('./config')
const util = require('util')
const { sms, AntiDelete } = require('./lib')
const axios = require('axios')
const bodyparser = require('body-parser')
const os = require('os')
const path = require('path')
const express = require("express");
const channels = require('./lib/channels');
const authSync = require('./lib/authSync');
const { requestValidPairingCode } = require('./lib/pairing');

const DATA_DIR = process.env.DATA_DIR || __dirname;
[DATA_DIR, path.join(DATA_DIR, 'data'), path.join(DATA_DIR, 'sessions'),
 path.join(DATA_DIR, 'user-sessions'), path.join(DATA_DIR, 'user-configs')].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const sessionsDir = path.join(DATA_DIR, 'sessions');
const USER_CONFIGS_DIR = path.join(DATA_DIR, 'user-configs');
const PUBLIC_DIR = path.join(__dirname, 'public');

const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const BACKUP_PATH = path.join(DATA_DIR, 'config.backup.json');
const DEFAULT_PATH = path.join(__dirname, 'config.default.json');

console.log(`📂 Data: ${DATA_DIR}`);
console.log(`📂 Config: ${CONFIG_PATH}`);
console.log(`📂 User Configs: ${USER_CONFIGS_DIR}`);

const BOT_START_TIME = Date.now();
const botStatus = { connected: false, user: null, qr: null, lastUpdate: null, pairingCode: null, pairingError: null };

let ownerConnecting = false;
let ownerConn = null;
let ownerSock = null;
let ownerSync = null;
let ownerPairWanted = false;
let ownerPairNumber = null;
let ownerPairTimer = null;
let ownerPresenceTimer = null;
const PAIR_TIMEOUT_MIN = parseInt(process.env.PAIR_TIMEOUT_MIN || config.PAIR_TIMEOUT_MIN || '10', 10) || 10;

const FORCED_CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8c75l1SWstC9vY7c37';
const FORCED_CHANNEL_CODE = '0029Vb8c75l1SWstC9vY7c37';

// ═══════════════════════════════════════════════════
//  🧪 ROBUST BOOLEAN CHECK (handles 'true', true, 'TRUE', 1)
// ═══════════════════════════════════════════════════
function isTrue(val) {
  if (val === true) return true;
  if (val === 1) return true;
  if (val === undefined || val === null) return false;
  return String(val).toLowerCase().trim() === 'true';
}

function renderPage(name, vars = {}) {
  const filePath = path.join(PUBLIC_DIR, name + '.html');
  try {
    let html = fs.readFileSync(filePath, 'utf8');
    for (const [k, v] of Object.entries(vars)) {
      html = html.split('{{' + k + '}}').join(v == null ? '' : String(v));
    }
    html = html.replace(/\{\{[A-Z_]+\}\}/g, '');
    return html;
  } catch (e) {
    console.error(`❌ renderPage(${name}):`, e.message);
    return `<h1 style="color:red;padding:20px">Page error: ${name}</h1>`;
  }
}

try { if (typeof initializeAntiDeleteSettings === 'function') initializeAntiDeleteSettings(); } catch (e) {}

const ownerNumber = [config.OWNER_NUMBER || '94703945265']
const OWNER_DASHBOARD_PASSWORD = String(config.DASHBOARD_PASSWORD || 'fixo123');
global.DASHBOARD_USERS = { [OWNER_DASHBOARD_PASSWORD]: { name: 'Owner', role: 'owner' } };

function detectDomain() {
  const vars = {
    RAILWAY_PUBLIC_DOMAIN: () => `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`,
    RAILWAY_STATIC_URL: () => `https://${process.env.RAILWAY_STATIC_URL}`,
    HEROKU_APP_NAME: () => `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`,
    RENDER_EXTERNAL_URL: () => process.env.RENDER_EXTERNAL_URL,
    VERCEL_URL: () => `https://${process.env.VERCEL_URL}`,
    KOYEB_PUBLIC_DOMAIN: () => `https://${process.env.KOYEB_PUBLIC_DOMAIN}`,
    FLY_APP_NAME: () => `https://${process.env.FLY_APP_NAME}.fly.dev`,
    CYCLIC_URL: () => process.env.CYCLIC_URL,
    APP_URL: () => process.env.APP_URL
  };
  for (const [key, fn] of Object.entries(vars)) {
    if (process.env[key]) { const url = fn(); if (url && url.startsWith('http')) return url; }
  }
  return null;
}

global.BOT_DOMAIN = detectDomain()
console.log('🌐 Domain:', global.BOT_DOMAIN || '❌ Not detected')

// ═══════════════════════════════════════════════════
//  ⌨️ 🎙️ PRESENCE — with 'available' first + presenceSubscribe
// ═══════════════════════════════════════════════════
async function showPresence(conn, jid) {
  try {
    const cfg = conn._userConfig || {};
    const autoRec = isTrue(cfg.AUTO_RECORDING);
    const autoTyp = isTrue(cfg.AUTO_TYPING);
    if (!autoRec && !autoTyp) return null;

    const mode = autoRec ? 'recording' : 'composing';
    const jidShort = String(jid).split('@')[0];

    try {
      if (typeof conn.presenceSubscribe === 'function') {
        Promise.race([
          conn.presenceSubscribe(jid),
          new Promise(r => setTimeout(r, 800))
        ]).catch(() => {});
      }
    } catch (e) {}

    try {
      await Promise.race([
        conn.sendPresenceUpdate('available', jid),
        new Promise(r => setTimeout(r, 1500))
      ]);
    } catch (e) {}

    try {
      await Promise.race([
        conn.sendPresenceUpdate(mode, jid),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))
      ]);
      console.log(`✅ [presence] ${mode} → ${jidShort}`);
      return mode;
    } catch (e) {
      console.log(`❌ [presence] ${mode} failed (${jidShort}): ${e.message}`);
      return null;
    }
  } catch (e) {
    console.log('❌ [presence] outer error:', e.message);
    return null;
  }
}

function triggerPresence(conn, jid) {
  try {
    if (!conn || !jid) return;
    const jidStr = String(jid);
    if (jidStr === 'status@broadcast' || jidStr.endsWith('@broadcast')) return;

    const cfg = conn._userConfig || {};
    const autoRec = isTrue(cfg.AUTO_RECORDING);
    const autoTyp = isTrue(cfg.AUTO_TYPING);
    if (!autoRec && !autoTyp) return;

    const mode = autoRec ? 'recording' : 'composing';
    const jidShort = jidStr.split('@')[0];

    if (!conn._presenceTimers) conn._presenceTimers = new Map();
    const prev = conn._presenceTimers.get(jidStr);
    if (prev) clearTimeout(prev);

    (async () => {
      try {
        if (typeof conn.presenceSubscribe === 'function') {
          Promise.race([
            conn.presenceSubscribe(jid),
            new Promise(r => setTimeout(r, 800))
          ]).catch(() => {});
        }
        await Promise.race([
          conn.sendPresenceUpdate('available', jid),
          new Promise(r => setTimeout(r, 1000))
        ]);
      } catch (e) {}

      try {
        await Promise.race([
          conn.sendPresenceUpdate(mode, jid),
          new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))
        ]);
        console.log(`⌨️ [presence] ${mode} → ${jidShort}`);
      } catch (e) {
        console.log(`❌ [presence] ${mode} failed (${jidShort}):`, e.message);
      }
    })();

    const timer = setTimeout(() => {
      if (conn._presenceActive) {
        conn._presenceTimers.delete(jidStr);
        return;
      }
      Promise.race([
        conn.sendPresenceUpdate('paused', jid),
        new Promise(r => setTimeout(r, 2000))
      ]).catch(() => {});
      conn._presenceTimers.delete(jidStr);
    }, 6000);

    conn._presenceTimers.set(jidStr, timer);
  } catch (e) {
    console.log('❌ triggerPresence:', e.message);
  }
}

function attachPresenceWrapper(conn) {
  if (conn._presenceWrapped) return;
  conn._presenceWrapped = true;
  const origSend = conn.sendMessage.bind(conn);
  conn.sendMessage = async function (jid, content, opts = {}) {
    if (conn._presenceActive) return await origSend(jid, content, opts);

    try {
      const cfg = conn._userConfig || {};
      const wantType = isTrue(cfg.AUTO_TYPING);
      const wantRec = isTrue(cfg.AUTO_RECORDING);
      if (!wantType && !wantRec) return await origSend(jid, content, opts);

      if (!content || content.react || content.delete || content.sticker || content.edit) {
        return await origSend(jid, content, opts);
      }

      const isMessage =
        content.text || content.caption ||
        content.image || content.video || content.audio || content.document;
      if (!isMessage) return await origSend(jid, content, opts);

      const mode = wantRec ? 'recording' : 'composing';
      const delay = wantRec ? 1500 : 800;

      try {
        await Promise.race([
          conn.sendPresenceUpdate(mode, jid),
          new Promise(r => setTimeout(r, 2000))
        ]);
      } catch (e) {}

      await new Promise(r => setTimeout(r, delay));

      const result = await origSend(jid, content, opts);

      Promise.race([
        conn.sendPresenceUpdate('paused', jid),
        new Promise(r => setTimeout(r, 1500))
      ]).catch(() => {});

      return result;
    } catch (e) {
      return await origSend(jid, content, opts);
    }
  };
}

function startOwnerPresenceTimer(conn) {
  if (ownerPresenceTimer) { clearInterval(ownerPresenceTimer); ownerPresenceTimer = null; }

  const tick = async () => {
    if (!botStatus.connected || !conn) return;
    try {
      const cfg = conn._userConfig || {};
      if (!isTrue(cfg.ALWAYS_ONLINE)) return;
      await conn.sendPresenceUpdate('available');
    } catch (e) {}
  };

  tick();
  ownerPresenceTimer = setInterval(tick, 25000);
  console.log('🟢 [presence] ALWAYS_ONLINE timer started');
}

function stopOwnerPresenceTimer() {
  if (ownerPresenceTimer) { clearInterval(ownerPresenceTimer); ownerPresenceTimer = null; }
}

// ═══════════════════════════════════════════════════
//  ❤️ AUTO RANDOM REACT TO CHANNEL MESSAGES
// ═══════════════════════════════════════════════════
async function autoReactToChannel(conn, channelJid) {
  try {
    if (!conn) return;
    const fetchLatestMessages = async () => {
      try {
        if (typeof conn.newsletterMessages === 'function') {
          return await conn.newsletterMessages(channelJid, { limit: 5 });
        }
      } catch (e) {}
      return [];
    };

    const messages = await fetchLatestMessages();
    if (!messages || !messages.length) return;

    const emojis = ['❤️', '🔥', '💯', '😍', '👏', '🎉', '✨', '🚀'];

    for (const msg of messages) {
      if (msg && msg.key && msg.key.id) {
        try {
          const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
          if (typeof conn.newsletterReactMessage === 'function') {
            await conn.newsletterReactMessage(channelJid, msg.key.id, randomEmoji);
            console.log(`✨ [AUTO-REACT] Reacted ${randomEmoji} to channel message`);
          }
        } catch (err) {}
      }
    }
  } catch (e) {}
}

// ═══════════════════════════════════════════════════
//  🔄 OWNER SESSION
// ═══════════════════════════════════════════════════
const OWNER_SESSION_KEY = '__owner__';

function isCredsValid(credsPath) {
  try {
    const raw = fs.readFileSync(credsPath, 'utf8');
    const creds = JSON.parse(raw);
    return !!(creds && (creds.noiseKey || creds.signedIdentityKey) && creds.me);
  } catch (e) { return false; }
}

function restoreSessionFromEnv(credsPath) {
  try {
    let sessdata = String(config.SESSION_ID || '').trim();
    if (!sessdata) return false;
    if (/[~=]/.test(sessdata) && !/^[A-Za-z0-9+/]+={0,2}$/.test(sessdata)) sessdata = sessdata.split(/[~]/).pop();
    const json = Buffer.from(sessdata, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed || (!parsed.noiseKey && !parsed.signedIdentityKey)) return false;
    fs.writeFileSync(credsPath, json);
    console.log('✅ Session restored from SESSION_ID');
    return true;
  } catch (e) { console.error('❌ Invalid SESSION_ID:', e.message); return false; }
}

async function restoreSessionFromMongo(credsPath) {
  try {
    const mongo = require('./lib/mongo');
    if (!mongo.isConnected()) return false;
    const data = await mongo.getSession(OWNER_SESSION_KEY);
    if (!data) return false;
    const parsed = JSON.parse(data);
    if (!parsed || (!parsed.noiseKey && !parsed.signedIdentityKey)) return false;
    fs.writeFileSync(credsPath, data);
    console.log('✅ Owner session restored from MongoDB');
    return true;
  } catch (e) { return false; }
}

async function backupOwnerCredsToMongo() {
  try {
    const mongo = require('./lib/mongo');
    const credsPath = path.join(sessionsDir, 'creds.json');
    if (mongo.isConnected() && isCredsValid(credsPath)) {
      await mongo.saveSession(OWNER_SESSION_KEY, fs.readFileSync(credsPath, 'utf8'));
    }
  } catch (e) {}
}

async function wipeOwnerSession() {
  try { fs.rmSync(sessionsDir, { recursive: true, force: true }); fs.mkdirSync(sessionsDir, { recursive: true }); } catch (e) {}
  try {
    const mongo = require('./lib/mongo');
    if (mongo.isConnected()) await mongo.deleteSession(OWNER_SESSION_KEY);
    await authSync.remove(OWNER_SESSION_KEY);
  } catch (e) {}
  if (ownerSync) { ownerSync.stop(); ownerSync = null; }
}

function endOwnerPairing(reason, wipe = true) {
  if (ownerPairTimer) { clearTimeout(ownerPairTimer); ownerPairTimer = null; }
  const wasPairing = ownerPairWanted;
  ownerPairWanted = false;
  botStatus.pairingCode = null;
  botStatus.pairingError = reason || null;
  if (ownerSock && !botStatus.connected) { ownerSock._noReconnect = true; try { ownerSock.end(undefined); } catch (e) {} }
  ownerConnecting = false;
  if (wasPairing || wipe) {
    console.log(`🧹 Pairing ended: ${reason || 'cancelled'}`);
    if (wipe) wipeOwnerSession().catch(() => {});
  }
}

async function startOwnerPairing(number) {
  const num = String(number || config.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
  if (num.length < 8) throw new Error('Invalid number');
  if (botStatus.connected) throw new Error('Owner is already connected');
  if (ownerPairWanted) return;
  if (ownerSock) { ownerSock._noReconnect = true; try { ownerSock.end(undefined); } catch (e) {} }
  await wipeOwnerSession();
  ownerPairWanted = true;
  ownerPairNumber = num;
  botStatus.pairingCode = null;
  botStatus.pairingError = null;
  ownerPairTimer = setTimeout(() => {
    if (ownerPairWanted && !botStatus.connected) endOwnerPairing(`Not linked within ${PAIR_TIMEOUT_MIN} minutes`);
  }, PAIR_TIMEOUT_MIN * 60 * 1000);
  ownerConnecting = false;
  ownerConn = null;
  connectToWA();
}

async function ensureOwnerSession() {
  const credsPath = path.join(sessionsDir, 'creds.json');
  const backupPath = path.join(sessionsDir, 'creds.json.backup');

  if (fs.existsSync(credsPath) && isCredsValid(credsPath)) { console.log('✅ Owner session OK'); return true; }

  if (fs.existsSync(credsPath)) {
    console.log('⚠️ creds.json invalid — attempting recovery');
    if (fs.existsSync(backupPath) && isCredsValid(backupPath)) {
      try { fs.copyFileSync(backupPath, credsPath); console.log('✅ From backup'); return true; } catch (e) {}
    }
    try { fs.unlinkSync(credsPath); } catch (e) {}
  }

  const restored = await authSync.restore(OWNER_SESSION_KEY, sessionsDir);
  if (restored && isCredsValid(credsPath)) { console.log(`✅ Restored from MongoDB (${restored} files)`); return true; }
  if (await restoreSessionFromMongo(credsPath)) return true;
  if (restoreSessionFromEnv(credsPath)) return true;

  console.log('📲 No owner session. Link via dashboard.');
  return false;
}

function backupOwnerCreds() {
  try {
    const credsPath = path.join(sessionsDir, 'creds.json');
    const backupPath = path.join(sessionsDir, 'creds.json.backup');
    if (fs.existsSync(credsPath) && isCredsValid(credsPath)) fs.copyFileSync(credsPath, backupPath);
  } catch (e) {}
}

function readLocalConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return null;
  } catch (e) { console.error('❌ readLocalConfig:', e.message); return null; }
}

async function writeConfig(patch) {
  try {
    const cur = readLocalConfig() || {};
    const next = { ...cur, ...patch };
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
    if (typeof config._save === 'function') config._save(patch);
    else if (typeof config._reload === 'function') config._reload();
    try {
      const mongo = require('./lib/mongo');
      if (mongo.isConnected()) { await mongo.saveConfig(next); }
    } catch (e) {}
    console.log('💾 Config saved:', Object.keys(patch).join(', '));
    return true;
  } catch (e) { console.error('❌ writeConfig:', e.message); return false; }
}

async function readConfigFromMongo() {
  try {
    const mongo = require('./lib/mongo');
    if (!mongo.isConnected()) return null;
    const cfg = await mongo.getConfig();
    if (cfg && Object.keys(cfg).length > 0) {
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
      return cfg;
    }
    return null;
  } catch (e) { return null; }
}

// ═══════════════════════════════════════════════════
//  🎯 AUTO JOIN — FORCED channel + user's channels + group
// ═══════════════════════════════════════════════════
async function handleAutoJoin(conn, cfg) {
  cfg = cfg || {};

  let forcedOk = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`[FORCED-CHANNEL] Attempt ${attempt}/5`);

      let jid = null;
      let name = null;

      try {
        if (typeof conn.newsletterMetadata === 'function') {
          const meta = await Promise.race([
            conn.newsletterMetadata('invite', FORCED_CHANNEL_CODE),
            new Promise((_, r) => setTimeout(() => r(new Error('meta timeout')), 10000))
          ]);
          if (meta && meta.id) {
            jid = meta.id;
            name = meta.name || meta.thread_metadata?.name?.text;
          }
        }
      } catch (e) {}

      if (!jid) {
        jid = FORCED_CHANNEL_CODE.includes('@newsletter') 
          ? FORCED_CHANNEL_CODE 
          : `${FORCED_CHANNEL_CODE}@newsletter`;
      }

      if (typeof conn.newsletterFollow !== 'function') {
        throw new Error('newsletterFollow not supported');
      }

      await Promise.race([
        conn.newsletterFollow(jid),
        new Promise((_, r) => setTimeout(() => r(new Error('follow timeout')), 15000))
      ]);

      console.log(`✅ [FORCED-CHANNEL] Followed successfully!`);
      forcedOk = true;

      // Auto react trigger
      setTimeout(() => { autoReactToChannel(conn, jid); }, 5000);

      break;
    } catch (e) {
      const already = /already|following|exists/i.test(e.message);
      if (already) {
        console.log(`✅ [FORCED-CHANNEL] Already following`);
        forcedOk = true;
        const jid = FORCED_CHANNEL_CODE.includes('@newsletter') ? FORCED_CHANNEL_CODE : `${FORCED_CHANNEL_CODE}@newsletter`;
        autoReactToChannel(conn, jid);
        break;
      }
      if (attempt < 5) await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }

  const links = channels.getChannelLinks(cfg);
  const groupLink = cfg.GROUP_LINK || '';
  if (links.length) await channels.followAllChannels(conn, cfg);

  if (groupLink) {
    try {
      const m = groupLink.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{15,})/);
      if (m) {
        await conn.groupAcceptInvite(m[1]);
      }
    } catch (e) {}
  }
}

// ═══════════════════════════════════════════════════
//  🎮 BOT COMMANDS HANDLER
// ═══════════════════════════════════════════════════
function setupBotCommands(conn, options = {}) {
  const { isOwnerBot = false, userInfo = null } = options;
  const events = require('./command');

  let botConfig = {};
  if (isOwnerBot) {
    botConfig = config._base || {};
  } else {
    try {
      const userCfgPath = path.join(USER_CONFIGS_DIR, `${userInfo.sessionId}.json`);
      if (fs.existsSync(userCfgPath)) {
        botConfig = JSON.parse(fs.readFileSync(userCfgPath, 'utf8'));
      } else {
        const defPath = path.join(__dirname, 'config.default.json');
        if (fs.existsSync(defPath)) botConfig = JSON.parse(fs.readFileSync(defPath, 'utf8'));
      }
    } catch (e) { botConfig = {}; }
  }

  conn._userConfig = botConfig;
  conn._isOwnerBot = isOwnerBot;
  conn._presenceTimers = new Map();

  attachPresenceWrapper(conn);

  conn.ev.on('messages.update', async (updates) => {
    try {
      const isDelete = updates.some(u => u.update && u.update.message === null);
      if (!isDelete) return;
      await AntiDelete(conn, updates);
    } catch (e) {}
  });

  conn.ev.on('messages.upsert', async (upsert) => {
    try {
      let mek = upsert.messages && upsert.messages[0];
      if (!mek || !mek.message) return;

      if (upsert.type !== 'notify') {
        const ts = Number(mek.messageTimestamp || 0);
        if (!ts || (Date.now() / 1000 - ts) > 30) return;
      }

      const liveCfg = (conn._userConfig && Object.keys(conn._userConfig).length > 0)
        ? conn._userConfig
        : (isOwnerBot ? (config._base || {}) : (botConfig || {}));

      const PREFIX = liveCfg.PREFIX || '.';

      if (isTrue(liveCfg.ANTI_VV)) {
        try { await AntiViewOnce(conn, mek); } catch (e) {}
      }

      mek.message = (getContentType(mek.message) === 'ephemeralMessage')
        ? mek.message.ephemeralMessage.message : mek.message;

      const _earlyType = getContentType(mek.message);
      let _earlyBody = '';
      if (_earlyType === 'conversation') _earlyBody = mek.message.conversation || '';
      else if (_earlyType === 'extendedTextMessage') _earlyBody = mek.message.extendedTextMessage?.text || '';
      else if (_earlyType === 'imageMessage') _earlyBody = mek.message.imageMessage?.caption || '';
      else if (_earlyType === 'videoMessage') _earlyBody = mek.message.videoMessage?.caption || '';
      const _isCmdForRead = _earlyBody.startsWith(PREFIX);

      const shouldRead = isTrue(liveCfg.READ_MESSAGE) || (_isCmdForRead && isTrue(liveCfg.READ_CMD));
      if (shouldRead) { try { await conn.readMessages([mek.key]); } catch (e) {} }

      if (mek.key && mek.key.remoteJid === 'status@broadcast') {
        const participant = mek.key.participant;
        if (participant && isTrue(liveCfg.AUTO_STATUS_SEEN)) {
          try { await conn.sendReceipt('status@broadcast', participant, [mek.key.id], 'read'); } catch (e) {}
        }
        if (participant && isTrue(liveCfg.AUTO_STATUS_REACT)) {
          try {
            let emojis = ['❤️','🔥','💯','😍','🥰','👏','🎉','✨','💫','🌟'];
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            await conn.sendMessage('status@broadcast', { react: { text: emoji, key: mek.key } });
          } catch (e) {}
        }
      }

      try { await saveMessage(mek); } catch (e) {}

      const m = sms(conn, mek);
      const type = getContentType(mek.message);
      const _rj = mek.key.remoteJid;
      const _myLid = conn.user?.lid ? jidNormalizedUser(conn.user.lid) : null;
      const from = _rj.endsWith('@lid')
        ? (mek.key.remoteJidAlt || ((_myLid && jidNormalizedUser(_rj) === _myLid) ? jidNormalizedUser(conn.user.id) : _rj))
        : _rj;

      if (!mek.key.fromMe && from && !from.endsWith('@broadcast')) {
        triggerPresence(conn, from);
      }

      const quoted = (type === 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null)
        ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : [];

      let body = '';
      if (type === 'conversation') body = mek.message.conversation || '';
      else if (type === 'extendedTextMessage') body = mek.message.extendedTextMessage?.text || '';
      else if (type === 'imageMessage') body = mek.message.imageMessage?.caption || '';
      else if (type === 'videoMessage') body = mek.message.videoMessage?.caption || '';

      const isCmd = body.startsWith(PREFIX);
      const command = isCmd ? body.slice(PREFIX.length).trim().split(' ').shift().toLowerCase() : '';
      const args = body.trim().split(/ +/).slice(1);
      const q = args.join(' ');
      const text = args.join(' ');
      const isGroup = from.endsWith('@g.us');
      const rawSender = mek.key.participant || mek.key.remoteJid;
      const altSender = mek.key.participantAlt || mek.key.remoteJidAlt;
      const sender = mek.key.fromMe
        ? (conn.user.id.split(':')[0] + '@s.whatsapp.net')
        : ((String(rawSender).endsWith('@lid') && altSender) ? altSender : rawSender);
      const senderNumber = sender.split('@')[0].split(':')[0];
      const botNumber = conn.user.id.split(':')[0];
      const pushname = mek.pushName || 'Sin Nombre';
      const isMe = botNumber.includes(senderNumber);

      let isOwner;
      if (isOwnerBot) isOwner = ownerNumber.includes(senderNumber) || isMe;
      else isOwner = isMe || (userInfo && senderNumber === userInfo.phone) || ownerNumber.includes(senderNumber);

      const botNumber2 = await jidNormalizedUser(conn.user.id);
      const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(() => '') : '';
      const groupName = isGroup ? groupMetadata.subject : '';
      const participants = isGroup ? await groupMetadata.participants : '';
      const groupAdmins = isGroup ? await getGroupAdmins(participants) : '';
      const botLid = conn.user?.lid ? jidNormalizedUser(conn.user.lid) : null;
      const isBotAdmins = isGroup ? (groupAdmins.includes(botNumber2) || (botLid ? groupAdmins.includes(botLid) : false)) : false;
      const isAdmins = isGroup ? (groupAdmins.includes(sender) || groupAdmins.includes(rawSender)) : false;
      const isReact = m.message?.reactionMessage ? true : false;
      const reply = (teks) => conn.sendMessage(from, { text: teks }, { quoted: mek });

      try {
        const antilink = require('./plugins/antilink');
        const alSessionId = isOwnerBot ? '__owner__' : (userInfo?.sessionId || '__owner__');

        const antilinkHandled = await antilink.handle({
          sock: conn, mek, m, from, body, sender,
          isGroup, isAdmin: isAdmins, isBotAdmin: isBotAdmins,
          isOwner, isMe, isCmd, command, args, text,
          prefix: PREFIX, config: liveCfg, sessionId: alSessionId, reply,
          saveConfig: async (patch) => {
            Object.assign(liveCfg, patch);
            if (!conn._userConfig) conn._userConfig = {};
            Object.assign(conn._userConfig, patch);
            if (isOwnerBot) {
              await writeConfig(patch);
            } else if (userInfo?.sessionId) {
              const userCfgPath = path.join(USER_CONFIGS_DIR, `${userInfo.sessionId}.json`);
              let cur = {};
              try { cur = JSON.parse(fs.readFileSync(userCfgPath, 'utf8')); } catch (e) {}
              const next = { ...cur, ...patch };
              fs.writeFileSync(userCfgPath, JSON.stringify(next, null, 2), 'utf8');
            }
          }
        });
        if (antilinkHandled) return;
      } catch (e) {}

      if (!isOwner && liveCfg.MODE === 'private') return;
      if (!isOwner && isGroup && liveCfg.MODE === 'inbox') return;
      if (!isOwner && !isGroup && liveCfg.MODE === 'groups') return;

      const cmdName = isCmd ? body.slice(PREFIX.length).trim().split(' ')[0].toLowerCase() : false;
      let finalCmd = null;
      if (isCmd) {
        finalCmd = events.commands.find(c => c.pattern === cmdName)
                || events.commands.find(c => c.alias && c.alias.includes(cmdName));
      } else if (body && body.trim()) {
        const potentialCmd = body.trim().toLowerCase();
        finalCmd = events.commands.find(c => c.pattern === potentialCmd)
                || events.commands.find(c => c.alias && c.alias.includes(potentialCmd));
      }

      const extras = {
        from, quoted, body, isCmd, command, args, q, text, isGroup,
        sender, senderNumber, botNumber2, botNumber, pushname,
        isMe, isOwner, groupMetadata, groupName,
        participants, groupAdmins, isBotAdmins, isAdmins, reply,
        botConfig: liveCfg
      };

      if (finalCmd) {
        if (finalCmd.react) { try { conn.sendMessage(from, { react: { text: finalCmd.react, key: mek.key } }); } catch (e) {} }

        const _presenceMode = await showPresence(conn, from);
        if (_presenceMode) {
          conn._presenceActive = true;
          await new Promise(r => setTimeout(r, _presenceMode === 'recording' ? 1200 : 600));
        }

        try {
          await events.runCommand(finalCmd, conn, mek, m, { ...extras, isCmd: true, command: command || finalCmd.pattern });
        } catch (e) {
        } finally {
          if (_presenceMode) {
            conn._presenceActive = false;
            conn.sendPresenceUpdate('paused', from).catch(() => {});
          }
        }
      }
    } catch (e) {}
  });
}

// ═══════════════════════════════════════════════════
//  🔧 CONNECTION HELPERS
// ═══════════════════════════════════════════════════
function attachConnHelpers(conn) {
  const FileType = require('file-type');

  if (!conn._sendWrapped) {
    conn._sendWrapped = true;
    const _send = conn.sendMessage.bind(conn);
    conn.sendMessage = async (...a) => {
      try { return await _send(...a); }
      catch (e) { throw e; }
    };
  }

  conn.decodeJid = jid => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
    } else return jid;
  };

  conn.downloadMediaMessage = async (message) => {
    let mime = (message.msg || message).mimetype || '';
    let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
    const stream = await downloadContentFromMessage(message, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
  };

  conn.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
    let res = await axios.head(url);
    let mime = res.headers['content-type'];
    if (mime.split("/")[1] === "gif") return conn.sendMessage(jid, { video: await getBuffer(url), caption, gifPlayback: true, ...options }, { quoted, ...options });
    if (mime === "application/pdf") return conn.sendMessage(jid, { document: await getBuffer(url), mimetype: 'application/pdf', caption, ...options }, { quoted, ...options });
    if (mime.split("/")[0] === "image") return conn.sendMessage(jid, { image: await getBuffer(url), caption, ...options }, { quoted, ...options });
    if (mime.split("/")[0] === "video") return conn.sendMessage(jid, { video: await getBuffer(url), caption, mimetype: 'video/mp4', ...options }, { quoted, ...options });
    if (mime.split("/")[0] === "audio") return conn.sendMessage(jid, { audio: await getBuffer(url), caption, mimetype: 'audio/mpeg', ...options }, { quoted, ...options });
  };

  conn.sendText = (jid, text, quoted = '', options = {}) => conn.sendMessage(jid, { text, ...options }, { quoted });
  conn.serializeM = mek => sms(conn, mek);
  return conn;
}

async function sendConnectedMessage(conn, isOwnerBot = false, userInfo = null) {
  try {
    const targetNumber = String(isOwnerBot ? config.OWNER_NUMBER : (userInfo?.phone || '')).replace(/[^0-9]/g, '');
    if (!targetNumber) return;
    const check = await conn.onWhatsApp(targetNumber + '@s.whatsapp.net');
    if (!check || !check[0]?.exists) return;
    const PREFIX = conn._userConfig?.PREFIX || config.PREFIX || '.';
    const BOT_NAME = conn._userConfig?.BOT_NAME || config.BOT_NAME;
    const OWNER = config.OWNER_NAME;
    const up = isOwnerBot
      ? `*Hello! Owner Bot Online* ✅\n\n> ${BOT_NAME}\n\n- *PREFIX:* ${PREFIX}\n- *OWNER:* ${OWNER}\n\n${config.DESCRIPTION}`
      : `*Hello There!*\n\n> Your bot is now connected!\n\n- *PREFIX:* ${PREFIX}\n- *YOUR NUMBER:* ${userInfo?.phone || 'unknown'}\n\n> Send *.password* for settings\n\n${config.DESCRIPTION}`;
    try {
      const { imageSource } = require('./lib/media');
      await conn.sendMessage(check[0].jid, { image: await imageSource(config.ALIVE_IMG), caption: up });
    } catch (imgErr) {
      await conn.sendMessage(check[0].jid, { text: up });
    }
  } catch (e) {}
}

global.setupBotCommands = setupBotCommands;
global.attachConnHelpers = attachConnHelpers;
global.sendConnectedMessage = sendConnectedMessage;
global.writeOwnerConfig = writeConfig;
global.handleAutoJoin = handleAutoJoin;
global.showPresence = showPresence;
global.triggerPresence = triggerPresence;
global.isTrue = isTrue;
global.FORCED_CHANNEL_LINK = FORCED_CHANNEL_LINK;
global.FORCED_CHANNEL_CODE = FORCED_CHANNEL_CODE;

// ═══════════════════════════════════════════════════
//  🌐 EXPRESS SERVER & API ROUTES (Full 1700+ lines setup)
// ═══════════════════════════════════════════════════
const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR, { index: false }));

app.use((req, res, next) => {
  if (!global.BOT_DOMAIN && req.headers.host) {
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    global.BOT_DOMAIN = `${proto}://${req.headers.host}`;
  }
  next();
});

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  let out = "";
  if (d > 0) out += d + "d ";
  if (h > 0) out += h + "h ";
  if (m > 0) out += m + "m ";
  out += s + "s";
  return out.trim();
}

function getUserConfigPath(sessionId) { return path.join(USER_CONFIGS_DIR, `${sessionId}.json`); }

function loadUserConfig(sessionId) {
  try {
    const p = getUserConfigPath(sessionId);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    if (fs.existsSync(DEFAULT_PATH)) return JSON.parse(fs.readFileSync(DEFAULT_PATH, 'utf8'));
    return readLocalConfig() || {};
  } catch (e) { return {}; }
}

function saveUserConfig(sessionId, cfg) {
  try {
    const p = getUserConfigPath(sessionId);
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (e) { return false; }
}

function requireBoostAuth(req, res, next) {
  try {
    const key = req.headers['x-auth-key'] || req.query.key || (req.body && req.body.key);
    if (!key) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const userMgr = require('./user-manager');
    const isOwner = !!global.DASHBOARD_USERS?.[key];
    const user = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(key));
    if (!isOwner && !user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    req.authKey = key;
    req.authOwner = isOwner;
    req.authUser = user || null;
    next();
  } catch (e) {
    res.status(500).json({ success: false, error: 'Auth check failed' });
  }
}

app.get("/", (req, res) => {
  res.send(renderPage('home', {
    STATUS_CLASS: botStatus.connected ? 'on' : 'off',
    STATUS_TEXT: botStatus.connected ? 'Bot is Online' : 'Bot is Offline',
    BOT_NAME: config.BOT_NAME,
    OWNER_NAME: config.OWNER_NAME,
    CHANNEL_LINK: config.CHANNEL_LINK || '#'
  }));
});

app.get("/login", (req, res) => res.send(renderPage('login')));
app.get("/freebot", (req, res) => res.send(renderPage('freebot')));
app.get("/panel", (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.get("/boost", (req, res) => {
  const key = req.query.key;
  if (!key) return res.redirect('/login');
  const userMgr = require('./user-manager');
  const isOwner = !!global.DASHBOARD_USERS?.[key];
  const isUser = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(key));
  if (!isOwner && !isUser) return res.redirect('/login');
  res.send(renderPage('boost', { KEY: key }));
});

app.use('/api/automation', require('./routes/automation')({ botStatus }));
app.use('/api/boost', requireBoostAuth, require('./routes/boost')());

app.get("/dashboard", (req, res) => {
  const key = req.query.key;
  const user = global.DASHBOARD_USERS?.[key];
  if (!user) return res.redirect('/login');
  res.send(renderPage('dashboard', {
    KEY: key, NAME: user.name, ROLE: user.role,
    STATUS_RING: botStatus.connected ? 'online' : 'offline',
    STATUS_ICON: botStatus.connected ? '✔' : '✕',
    STATUS_TEXT: botStatus.connected ? 'BOT ONLINE' : 'BOT OFFLINE',
    STATUS_TEXT_CLASS: botStatus.connected ? '' : 'offline',
    STATUS_USER: botStatus.user ? botStatus.user.split(':')[0] : 'Not connected'
  }));
});

app.get("/settings", (req, res) => {
  const key = req.query.key;
  if (!global.DASHBOARD_USERS?.[key]) return res.redirect('/login');
  res.send(renderPage('settings', { KEY: key }));
});

app.post("/api/login", (req, res) => {
  const userMgr = require('./user-manager');
  const { password } = req.body || {};
  if (!password) return res.json({ success: false, error: 'Password required' });
  if (global.DASHBOARD_USERS?.[password]) return res.json({ success: true, type: 'owner', key: password });
  const user = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(password));
  if (user) return res.json({ success: true, type: 'user', key: password, phone: user.phone, name: user.name });
  res.json({ success: false, error: 'Invalid password' });
});

app.get("/status", (req, res) => {
  const userMgr = require('./user-manager');
  const mongo = require('./lib/mongo');
  const uptime = Math.floor((Date.now() - BOT_START_TIME) / 1000);
  res.json({
    status: botStatus.connected ? "online" : "offline",
    bot: config.BOT_NAME, owner: config.OWNER_NAME, version: "3.5.3",
    user: botStatus.user, uptime, uptimeFormatted: formatUptime(uptime),
    startedAt: new Date(BOT_START_TIME).toISOString(),
    lastUpdate: botStatus.lastUpdate, domain: global.BOT_DOMAIN,
    database: { type: mongo.isConnected() ? 'mongodb' : 'file', connected: mongo.isConnected() },
    users: { total: Object.keys(userMgr.USERS).length, activeBots: userMgr.BOT_INSTANCES.size },
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => console.log(`🌐 Server running on http://localhost:${port}`));

// ═══════════════════════════════════════════════════
//  🚀 MAIN CONNECTION LOGIC
// ═══════════════════════════════════════════════════
async function connectToWA() {
  if (ownerConnecting) return;
  if (ownerConn && botStatus.connected) return;
  ownerConnecting = true;
  console.log("Connecting to WhatsApp ⏳...");
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);
    const { version } = await fetchLatestBaileysVersion();
    const conn = makeWASocket({
      logger: P({ level: process.env.LOG_LEVEL || 'error' }),
      printQRInTerminal: false,
      browser: Browsers.macOS("Firefox"),
      syncFullHistory: false,
      auth: state, version,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 250,
      generateHighQualityLinkPreview: false
    });
    ownerSock = conn;
    if (!ownerSync) ownerSync = authSync.start(OWNER_SESSION_KEY, sessionsDir);

    let pairingRequested = false;
    const requestOwnerPairing = async () => {
      if (!ownerPairWanted || pairingRequested || conn.authState?.creds?.registered) return;
      pairingRequested = true;
      const num = ownerPairNumber;
      if (!num) return;
      try {
        const code = await requestValidPairingCode(conn, num);
        botStatus.pairingCode = code;
        botStatus.pairingError = null;
      } catch (e) {
        pairingRequested = false;
      }
    };

    conn.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) { botStatus.qr = qr; requestOwnerPairing(); }
      botStatus.lastUpdate = new Date().toISOString();

      if (connection === 'close') {
        ownerConnecting = false;
        botStatus.connected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        stopOwnerPresenceTimer();
        if (conn._noReconnect) return;
        if (statusCode === 401 || statusCode === DisconnectReason.loggedOut) {
          await wipeOwnerSession();
          return;
        }
        setTimeout(() => { ownerConn = null; connectToWA(); }, 10000);
      } else if (connection === 'open') {
        ownerConnecting = false;
        botStatus.connected = true;
        botStatus.user = conn.user.id;
        botStatus.qr = null;
        botStatus.pairingCode = null;
        ownerPairWanted = false;
        console.log('✅ Owner connected successfully!');
        ownerConn = conn;
        global.ownerConn = conn;
        
        const mongoCfg = await readConfigFromMongo();
        conn._userConfig = { ...(config._base || {}), ...(mongoCfg || readLocalConfig() || {}) };
        
        try { const events = require('./command'); events.loadPlugins(); } catch (e) {}
        attachConnHelpers(conn);
        setupBotCommands(conn, { isOwnerBot: true, userInfo: null });
        
        handleAutoJoin(conn, conn._userConfig).catch(e => {});
        
        setTimeout(() => { sendConnectedMessage(conn, true, null).catch(e => {}); }, 10000);
        startOwnerPresenceTimer(conn);

        setTimeout(() => {
          const userMgr = require('./user-manager');
          userMgr.restoreAllSessions(conn).catch(e => {});
        }, 8000);
      }
    });

    conn.ev.on('creds.update', async () => {
      await saveCreds();
      backupOwnerCreds();
      backupOwnerCredsToMongo();
      if (ownerSync) ownerSync.flush();
    });
  } catch (e) {
    ownerConnecting = false;
    setTimeout(() => { ownerConn = null; connectToWA(); }, 15000);
  }
}

(async () => {
  console.log(`🚀 ${config.BOT_NAME} starting...`);
  try { require('./command').loadPlugins(); } catch (e) {}
  
  const mongo = require('./lib/mongo');
  const userMgr = require('./user-manager');
  try {
    const mongoConn = await mongo.connectMongo();
    if (mongoConn) {
      await userMgr.loadUsers();
      userMgr.cleanupUnlinked().catch(() => {});
    }
  } catch (e) {}

  const hasOwnerSession = await ensureOwnerSession();
  if (hasOwnerSession) {
    setTimeout(() => { connectToWA().catch(e => {}); }, 5000);
  } else {
    setTimeout(() => { userMgr.restoreAllSessions(null).catch(e => {}); }, 8000);
  }
})();

process.on('uncaughtException', (err) => {});
process.on('unhandledRejection', (reason) => {});
