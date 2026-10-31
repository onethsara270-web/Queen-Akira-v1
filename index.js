/*
   𝑸𝒖𝒆𝒆𝒏 𝑨𝒌𝒊𝒓𝒂 𝑴𝒊𝒏𝒊 - WhatsApp Multi-Device Bot
   Owner           : FIXO DEV (94703945265)
   Baileys         : fixo-baileys
   Version         : 3.0.0

   Base credit     : PathumTech (original base author) - credit kept as requested by the base license
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

// ═══════════════════════════════════════════════════
//  📁 DIRECTORIES
// ═══════════════════════════════════════════════════
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
let ownerSock = null;            // socket currently in use (used to stop an unfinished pairing)
let ownerSync = null;            // MongoDB auth-folder sync
let ownerPairWanted = false;     // true only while the owner pressed "Generate pairing code" on the dashboard
let ownerPairNumber = null;
let ownerPairTimer = null;
const PAIR_TIMEOUT_MIN = parseInt(process.env.PAIR_TIMEOUT_MIN || config.PAIR_TIMEOUT_MIN || '10', 10) || 10;

// ═══════════════════════════════════════════════════
//  🎨 PAGE RENDERER
// ═══════════════════════════════════════════════════
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
//  🔄 OWNER SESSION (self-contained — no external site)
//  Priority:  local creds.json  >  MongoDB backup  >  SESSION_ID (base64)  >  pairing code
// ═══════════════════════════════════════════════════
const OWNER_SESSION_KEY = '__owner__';

function isCredsValid(credsPath) {
  try {
    const raw = fs.readFileSync(credsPath, 'utf8');
    const creds = JSON.parse(raw);
    return !!(creds && (creds.noiseKey || creds.signedIdentityKey) && creds.me);
  } catch (e) { return false; }
}

// SESSION_ID = base64 of creds.json (optionally prefixed like "QUEEN-AKIRA~<base64>")
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
  } catch (e) { console.error('❌ Invalid SESSION_ID (expected base64 of creds.json):', e.message); return false; }
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
  if (ownerSync) { ownerSync.stop(); ownerSync = null; }   // restarted with an empty cache on next connect
}

// ── Owner pairing: ONLY when requested from the dashboard (never automatically) ──
function endOwnerPairing(reason, wipe = true) {
  if (ownerPairTimer) { clearTimeout(ownerPairTimer); ownerPairTimer = null; }
  const wasPairing = ownerPairWanted;
  ownerPairWanted = false;
  botStatus.pairingCode = null;
  botStatus.pairingError = reason || null;
  if (ownerSock && !botStatus.connected) { ownerSock._noReconnect = true; try { ownerSock.end(undefined); } catch (e) {} }
  ownerConnecting = false;
  if (wasPairing || wipe) {
    console.log(`🧹 Pairing ended: ${reason || 'cancelled'} — removing the unfinished session`);
    if (wipe) wipeOwnerSession().catch(() => {});
  }
}

async function startOwnerPairing(number) {
  const num = String(number || config.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
  if (num.length < 8) throw new Error('Invalid number');
  if (botStatus.connected) throw new Error('Owner is already connected');
  if (ownerPairWanted) return;
  if (ownerSock) { ownerSock._noReconnect = true; try { ownerSock.end(undefined); } catch (e) {} }
  await wipeOwnerSession();                    // always start from a clean, empty session
  ownerPairWanted = true;
  ownerPairNumber = num;
  botStatus.pairingCode = null;
  botStatus.pairingError = null;
  ownerPairTimer = setTimeout(() => {
    if (ownerPairWanted && !botStatus.connected) endOwnerPairing(`Not linked within ${PAIR_TIMEOUT_MIN} minutes — session deleted. Generate a new code.`);
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

  // 1) full session folder from MongoDB (creds + keys) — the reliable way
  const restored = await authSync.restore(OWNER_SESSION_KEY, sessionsDir);
  if (restored && isCredsValid(credsPath)) { console.log(`✅ Owner session restored from MongoDB (${restored} files)`); return true; }
  // 2) legacy: creds.json only, 3) SESSION_ID
  if (await restoreSessionFromMongo(credsPath)) return true;
  if (restoreSessionFromEnv(credsPath)) return true;

  console.log('📲 No owner session. Open the dashboard → "Link the owner WhatsApp" → Generate pairing code (nothing is sent to your phone until you do).');
  return false;
}

function backupOwnerCreds() {
  try {
    const credsPath = path.join(sessionsDir, 'creds.json');
    const backupPath = path.join(sessionsDir, 'creds.json.backup');
    if (fs.existsSync(credsPath) && isCredsValid(credsPath)) fs.copyFileSync(credsPath, backupPath);
  } catch (e) {}
}

// ═══════════════════════════════════════════════════
//  💾 CONFIG HELPERS
// ═══════════════════════════════════════════════════
function readLocalConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
    return null;
  } catch (e) { 
    console.error('❌ readLocalConfig:', e.message);
    return null; 
  }
}

async function writeConfig(patch) {
  try {
    const cur = readLocalConfig() || {};
    const next = { ...cur, ...patch };
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');

    if (typeof config._save === 'function') {
      config._save(patch);
    } else if (typeof config._reload === 'function') {
      config._reload();
    }

    try {
      const mongo = require('./lib/mongo');
      if (mongo.isConnected()) {
        await mongo.saveConfig(next);
        console.log('☁️  Config synced to MongoDB');
      }
    } catch (e) {
      console.log('⚠️  MongoDB sync failed:', e.message);
    }

    console.log('💾 Config saved:', Object.keys(patch).join(', '));
    return true;
  } catch (e) {
    console.error('❌ writeConfig:', e.message);
    return false;
  }
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
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════
//  🎯 AUTO JOIN — follows ALL configured channels (+ optional group)
// ═══════════════════════════════════════════════════
async function handleAutoJoin(conn, cfg) {
  cfg = cfg || {};
  const links = channels.getChannelLinks(cfg);
  const groupLink = cfg.GROUP_LINK || '';
  console.log(`\n🔍 [AUTO-JOIN] Channels: ${links.length} | Group: ${groupLink ? 'YES' : 'NO'}`);

  if (links.length) await channels.followAllChannels(conn, cfg);

  if (groupLink) {
    try {
      const m = groupLink.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{15,})/);
      if (m) {
        const res = await conn.groupAcceptInvite(m[1]);
        console.log(res ? '✅ [AUTO-JOIN] Group joined' : '⚠️ [AUTO-JOIN] Group join returned null (maybe already joined)');
      }
    } catch (e) { console.log('❌ [AUTO-JOIN] Group error:', e.message); }
  }
}

// ═══════════════════════════════════════════════════
//  🎮 BOT COMMANDS HANDLER (FULL)
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
      console.log(`📋 [USER ${userInfo.phone}] Config loaded: ${Object.keys(botConfig).length} keys`);
    } catch (e) { console.error('Config load error:', e.message); botConfig = {}; }
  }

  conn._userConfig = botConfig;
  conn._isOwnerBot = isOwnerBot;

  conn.ev.on('messages.update', async (updates) => {
    try {
      const isDelete = updates.some(u => u.update && u.update.message === null);
      if (!isDelete) return;

      const liveCfg = isOwnerBot ? null : (conn._userConfig || botConfig);
      console.log(`🔄 [DEL] isOwnerBot: ${isOwnerBot} | DM: ${liveCfg?.ANTI_DELETE_DM} | GC: ${liveCfg?.ANTI_DELETE_GC}`);

      await AntiDelete(conn, updates);
    } catch (e) {
      console.error('❌ AntiDelete handler error:', e.message);
    }
  });

  conn.ev.on('messages.upsert', async (upsert) => {
    try {
      let mek = upsert.messages && upsert.messages[0];

      // 🔎 Diagnostics (set DEBUG_MSG=false to silence): shows whether WhatsApp messages reach the bot at all
      if (process.env.DEBUG_MSG !== 'false' && mek) {
        const k = mek.key || {};
        console.log(`📥 [${upsert.type}] ${String(k.remoteJid).split('@')[0]}@${String(k.remoteJid).split('@')[1]} fromMe=${!!k.fromMe} ` +
          (mek.message ? `type=${Object.keys(mek.message).filter(x => x !== 'messageContextInfo').join(',')}` :
            `NO-CONTENT stub=${mek.messageStubType} ${JSON.stringify(mek.messageStubParameters || [])}`));
      }
      if (!mek || !mek.message) return;

      // History / offline backlog arrives as type 'append' — never run commands for old messages
      if (upsert.type !== 'notify') {
        const ts = Number(mek.messageTimestamp || 0);
        if (!ts || (Date.now() / 1000 - ts) > 30) return;
      }

      const liveCfg = (conn._userConfig && Object.keys(conn._userConfig).length > 0)
        ? conn._userConfig
        : (isOwnerBot ? (config._base || {}) : (botConfig || {}));

      const PREFIX = liveCfg.PREFIX || '.';

      mek.message = (getContentType(mek.message) === 'ephemeralMessage')
        ? mek.message.ephemeralMessage.message : mek.message;

      if (String(liveCfg.READ_MESSAGE) === 'true') {
        try { await conn.readMessages([mek.key]); } catch (e) {}
      }
      if (mek.message.viewOnceMessageV2) {
        mek.message = (getContentType(mek.message) === 'ephemeralMessage')
          ? mek.message.ephemeralMessage.message : mek.message;
      }

      if (mek.key && mek.key.remoteJid === 'status@broadcast') {
        const participant = mek.key.participant;
        if (participant && String(liveCfg.AUTO_STATUS_SEEN) === 'true') {
          try { await conn.sendReceipt('status@broadcast', participant, [mek.key.id], 'read'); } catch (e) {}
        }
        if (participant && String(liveCfg.AUTO_STATUS_REPLY) === 'true') {
          try {
            await conn.sendMessage(participant, {
              text: liveCfg.AUTO_STATUS_MSG || '*SEEN YOUR STATUS*',
              contextInfo: { remoteJid: 'status@broadcast', participant, stanzaId: mek.key.id, quotedMessage: mek.message, fromMe: false }
            });
          } catch (e) {}
        }
      }

      try { await saveMessage(mek); } catch (e) {}

      const m = sms(conn, mek);
      const type = getContentType(mek.message);
      // Always reply to the phone-number chat. A LID chat id (xxxx@lid) can resolve to a different/hidden thread.
      const _rj = mek.key.remoteJid;
      const _myLid = conn.user?.lid ? jidNormalizedUser(conn.user.lid) : null;
      const from = _rj.endsWith('@lid')
        ? (mek.key.remoteJidAlt || ((_myLid && jidNormalizedUser(_rj) === _myLid) ? jidNormalizedUser(conn.user.id) : _rj))
        : _rj;
      const quoted = (type === 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null)
        ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : [];

      let body = '';
      if (type === 'conversation') body = mek.message.conversation || '';
      else if (type === 'extendedTextMessage') body = mek.message.extendedTextMessage?.text || '';
      else if (type === 'imageMessage') body = mek.message.imageMessage?.caption || '';
      else if (type === 'videoMessage') body = mek.message.videoMessage?.caption || '';

      if (mek.message.buttonsResponseMessage) body = mek.message.buttonsResponseMessage.selectedButtonId || '';
      if (!body && mek.message.templateButtonReplyMessage) body = mek.message.templateButtonReplyMessage.selectedId || '';
      if (!body && mek.message.listResponseMessage) body = mek.message.listResponseMessage.singleSelectReply?.selectedRowId || '';
      if (!body && mek.message.interactiveResponseMessage) {
        try {
          const ir = mek.message.interactiveResponseMessage;
          if (ir?.nativeFlowResponseMessage?.paramsJson) {
            const params = JSON.parse(ir.nativeFlowResponseMessage.paramsJson);
            if (params.id) body = params.id;
          }
        } catch (e) {}
      }
      if (!body && mek.message.buttonsMessage) body = mek.message.buttonsMessage.contentText || '';

      const isCmd = body.startsWith(PREFIX);
      if (isCmd) console.log(`📩 ${from.endsWith('@g.us') ? 'GROUP' : 'DM'} command: ${body.slice(0, 60)}`);
      const budy = typeof mek.text === 'string' ? mek.text : false;
      const command = isCmd ? body.slice(PREFIX.length).trim().split(' ').shift().toLowerCase() : '';
      const args = body.trim().split(/ +/).slice(1);
      const q = args.join(' ');
      const text = args.join(' ');
      const isGroup = from.endsWith('@g.us');
      // WhatsApp now addresses many chats by LID (xxxx@lid). Prefer the phone-number JID when WhatsApp gives it.
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
          isGroup,
          isAdmin: isAdmins,
          isBotAdmin: isBotAdmins,
          isOwner, isMe, isCmd, command, args, text,
          prefix: PREFIX,
          config: liveCfg,
          sessionId: alSessionId,
          reply,
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
              console.log(`💾 [USER ${userInfo.phone}] Antilink saved:`, Object.keys(patch).join(', '));
            }
          }
        });

        if (antilinkHandled) return;
      } catch (e) {
        console.error('❌ Antilink error:', e.message);
      }

      const udp = botNumber.split('@')[0];

      // Only the bot's own number and the owner (DEV) may use the % / $ eval commands
      const isCreator = [udp, config.DEV]
        .filter(Boolean)
        .map(v => String(v).replace(/[^0-9]/g, '') + '@s.whatsapp.net')
        .includes(sender);

      if (isCreator && mek.text && mek.text.startsWith('%')) {
        let code = budy.slice(2);
        if (!code) { reply('Provide query!'); return; }
        try { let r = eval(code); reply(util.format(r)); } catch (e) { reply(util.format(e)); }
        return;
      }
      if (isCreator && mek.text && mek.text.startsWith('$')) {
        let code = budy.slice(2);
        if (!code) { reply('Provide query!'); return; }
        try { let r = await eval('const a = async()=>{\n' + code + '\n}\na()'); let h = util.format(r); if (h === undefined) return; else reply(h); }
        catch (e) { reply(util.format(e)); }
        return;
      }

      if (!isReact && String(liveCfg.AUTO_REACT) === 'true') {
        const REACTIONS = ['😊','👍','😂','💯','🔥','🙏','🎉','👏','😎','🤖','❤️'];
        try { m.react(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]); } catch (e) {}
      }

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
        isMe, isOwner, isCreator, groupMetadata, groupName,
        participants, groupAdmins, isBotAdmins, isAdmins, reply,
        botConfig: liveCfg
      };

      if (finalCmd) {
        if (finalCmd.react) { try { conn.sendMessage(from, { react: { text: finalCmd.react, key: mek.key } }); } catch (e) {} }
        try {
          await events.runCommand(finalCmd, conn, mek, m, { ...extras, isCmd: true, command: command || finalCmd.pattern });
        } catch (e) { console.error('[PLUGIN ERROR]', e.stack || e.message); }
      }

      const isViewOnce = !!(mek.message?.viewOnceMessageV2 || mek.message?.viewOnceMessageV2Extension || mek.message?.viewOnceMessage);
      const effectiveBody = body || (isViewOnce ? '[ViewOnce]' : '');

      for (const c of events.commands) {
        if (effectiveBody && c.on === 'body') {
          try {
            await events.runCommand(c, conn, mek, m, { ...extras, body: effectiveBody });
          } catch (e) {}
        }
      }

    } catch (e) { console.error('❌ Handler error:', e.stack || e.message); }
  });

  console.log(`✅ Commands for ${isOwnerBot ? 'OWNER' : 'USER ' + (userInfo?.phone || '?')}`);
}

// ═══════════════════════════════════════════════════
//  🔧 CONNECTION HELPERS (FULL)
// ═══════════════════════════════════════════════════
function attachConnHelpers(conn) {
  const FileType = require('file-type');

  // Never fail silently: if WhatsApp refuses a send (no session, bad jid, ...) the reason is printed.
  if (!conn._sendWrapped) {
    conn._sendWrapped = true;
    const _send = conn.sendMessage.bind(conn);
    conn.sendMessage = async (...a) => {
      try { return await _send(...a); }
      catch (e) { console.error(`❌ sendMessage failed → ${a[0]} :`, e.stack || e.message); throw e; }
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

  conn.cMod = (jid, copy, text = '', sender = conn.user.id, options = {}) => {
    let mtype = Object.keys(copy.message)[0];
    let isEphemeral = mtype === 'ephemeralMessage';
    if (isEphemeral) mtype = Object.keys(copy.message.ephemeralMessage.message)[0];
    let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message;
    let content = msg[mtype];
    if (typeof content === 'string') msg[mtype] = text || content;
    else if (content.caption) content.caption = text || content.caption;
    else if (content.text) content.text = text || content.text;
    if (typeof content !== 'string') msg[mtype] = { ...content, ...options };
    if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant;
    if (copy.key.remoteJid.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid;
    else if (copy.key.remoteJid.includes('@broadcast')) sender = sender || copy.key.remoteJid;
    copy.key.remoteJid = jid;
    copy.key.fromMe = sender === conn.user.id;
    return proto.WebMessageInfo.fromObject(copy);
  };

  conn.getFile = async (PATH, save) => {
    let res, filename;
    let data = Buffer.isBuffer(PATH) ? PATH
      : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64')
      : /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH))
      : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH))
      : typeof PATH === 'string' ? PATH : Buffer.alloc(0);
    let type = await FileType.fromBuffer(data) || { mime: 'application/octet-stream', ext: '.bin' };
    let savePath = path.join(__dirname, 'temp_' + (new Date() * 1) + '.' + type.ext);
    if (data && save) fs.promises.writeFile(savePath, data);
    return { res, filename: savePath, size: data.length, ...type, data };
  };

  conn.sendFile = async (jid, PATH, fileName, quoted = {}, options = {}) => {
    let types = await conn.getFile(PATH, true);
    let { filename, mime, data } = types;
    let type = '', mimetype = mime, pathFile = filename;
    if (options.asDocument) type = 'document';
    if (options.asSticker || /webp/.test(mime)) {
      let { writeExif } = require('./exif.js');
      let media = { mimetype: mime, data };
      pathFile = await writeExif(media, { packname: config.STICKER_NAME, author: config.STICKER_NAME, categories: options.categories || [] });
      await fs.promises.unlink(filename);
      type = 'sticker'; mimetype = 'image/webp';
    } else if (/image/.test(mime)) type = 'image';
    else if (/video/.test(mime)) type = 'video';
    else if (/audio/.test(mime)) type = 'audio';
    else type = 'document';
    await conn.sendMessage(jid, { [type]: { url: pathFile }, mimetype, fileName, ...options }, { quoted, ...options });
    return fs.promises.unlink(pathFile);
  };

  conn.parseMention = async (text) => [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net');

  conn.sendMedia = async (jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
    let types = await conn.getFile(path, true);
    let { mime, data, filename } = types;
    let type = '', mimetype = mime, pathFile = filename;
    if (options.asDocument) type = 'document';
    if (options.asSticker || /webp/.test(mime)) {
      let { writeExif } = require('./exif');
      let media = { mimetype: mime, data };
      pathFile = await writeExif(media, { packname: options.packname || config.STICKER_NAME, author: options.author || config.STICKER_NAME, categories: options.categories || [] });
      await fs.promises.unlink(filename);
      type = 'sticker'; mimetype = 'image/webp';
    } else if (/image/.test(mime)) type = 'image';
    else if (/video/.test(mime)) type = 'video';
    else if (/audio/.test(mime)) type = 'audio';
    else type = 'document';
    await conn.sendMessage(jid, { [type]: { url: pathFile }, caption, mimetype, fileName, ...options }, { quoted, ...options });
    return fs.promises.unlink(pathFile);
  };

  conn.sendVideoAsSticker = async (jid, buff, options = {}) => {
    let buffer;
    if (options && (options.packname || options.author)) buffer = await require('./exif').writeExifVid(buff, options);
    else buffer = await require('./exif').videoToWebp(buff);
    await conn.sendMessage(jid, { sticker: { url: buffer }, ...options }, options);
  };

  conn.sendImageAsSticker = async (jid, buff, options = {}) => {
    let buffer;
    if (options && (options.packname || options.author)) buffer = await require('./exif').writeExifImg(buff, options);
    else buffer = await require('./exif').imageToWebp(buff);
    await conn.sendMessage(jid, { sticker: { url: buffer }, ...options }, options);
  };

  conn.sendTextWithMentions = async (jid, text, quoted, options = {}) =>
    conn.sendMessage(jid, { text, contextInfo: { mentionedJid: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net') }, ...options }, { quoted });

  conn.sendImage = async (jid, path, caption = '', quoted = '', options = {}) => {
    let buffer = Buffer.isBuffer(path) ? path
      : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64')
      : /^https?:\/\//.test(path) ? await getBuffer(path)
      : fs.existsSync(path) ? fs.readFileSync(path)
      : Buffer.alloc(0);
    return await conn.sendMessage(jid, { image: buffer, caption, ...options }, { quoted });
  };

  conn.sendText = (jid, text, quoted = '', options = {}) => conn.sendMessage(jid, { text, ...options }, { quoted });

  conn.sendContact = async (jid, kon, quoted = '', opts = {}) => {
    let list = [];
    for (let i of kon) {
      list.push({
        displayName: i,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${i}\nFN:${config.OWNER_NAME}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Click here to chat\nEND:VCARD`,
      });
    }
    conn.sendMessage(jid, { contacts: { displayName: `${list.length} Contact`, contacts: list }, ...opts }, { quoted });
  };

  conn.getName = (jid, withoutContact = false) => {
    if (!jid) return '';
    const id = conn.decodeJid(jid);
    withoutContact = conn.withoutContact || withoutContact;
    if (id.endsWith('@g.us')) return id.replace('@g.us', '');
    if (id === '0@s.whatsapp.net') return 'WhatsApp';
    if (id === conn.decodeJid(conn.user.id)) return conn.user?.name || conn.user?.id || '';
    return withoutContact ? '' : id.replace('@s.whatsapp.net', '');
  };

  conn.setStatus = status => {
    conn.query({ tag: 'iq', attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'status' }, content: [{ tag: 'status', attrs: {}, content: Buffer.from(status, 'utf-8') }] });
    return status;
  };

  conn.serializeM = mek => sms(conn, mek);
  return conn;
}

// ═══════════════════════════════════════════════════
//  🎉 CONNECTED MESSAGE
// ═══════════════════════════════════════════════════
async function sendConnectedMessage(conn, isOwnerBot = false, userInfo = null) {
  try {
    // Owner bot -> tell the owner. User bot -> tell that user (their own number).
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
      console.log('⚠️ Connected image failed, sending text:', imgErr.message);
      await conn.sendMessage(check[0].jid, { text: up });
    }
  } catch (e) { console.log('❌ Connected msg:', e.message); }
}

global.setupBotCommands = setupBotCommands;
global.attachConnHelpers = attachConnHelpers;
global.sendConnectedMessage = sendConnectedMessage;
global.writeOwnerConfig = writeConfig;      // used by .addchannel / .delchannel
global.handleAutoJoin = handleAutoJoin;

console.log('✅ Global functions exposed');

// ═══════════════════════════════════════════════════
//  🌐 EXPRESS SERVER (FULL ROUTES)
// ═══════════════════════════════════════════════════
const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

app.use((req, res, next) => {
  if (!global.BOT_DOMAIN && req.headers.host) {
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    global.BOT_DOMAIN = `${proto}://${req.headers.host}`;
    console.log('🌐 Domain:', global.BOT_DOMAIN);
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
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    if (fs.existsSync(DEFAULT_PATH)) return JSON.parse(fs.readFileSync(DEFAULT_PATH, 'utf8'));
    return readLocalConfig() || {};
  } catch (e) {
    console.error('❌ [loadUserConfig]', e.message);
    return {};
  }
}

function saveUserConfig(sessionId, cfg) {
  try {
    const p = getUserConfigPath(sessionId);
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
    console.log(`💾 [saveUserConfig] ${sessionId} → keys=${Object.keys(cfg).length}`);
    return true;
  } catch (e) {
    console.error('❌ [saveUserConfig]', e.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════
//  🏠 PAGES
// ═══════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.send(renderPage('home', {
    STATUS_CLASS: botStatus.connected ? 'on' : 'off',
    STATUS_TEXT: botStatus.connected ? 'Bot is Online' : 'Bot is Offline'
  }));
});

app.get("/login", (req, res) => res.send(renderPage('login')));
app.get("/freebot", (req, res) => res.send(renderPage('freebot')));

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

app.get("/user/settings", (req, res) => {
  const userMgr = require('./user-manager');
  const key = req.query.key;
  const user = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(key));
  if (!user) return res.redirect('/login');
  res.send(renderPage('user-settings', {
    KEY: key, NAME: user.name, PHONE: user.phone, PASSWORD: user.dashPassword
  }));
});

// ═══════════════════════════════════════════════════
//  🔐 API: LOGIN
// ═══════════════════════════════════════════════════
app.post("/api/login", (req, res) => {
  const userMgr = require('./user-manager');
  const { password } = req.body || {};
  if (!password) return res.json({ success: false, error: 'Password required' });
  if (global.DASHBOARD_USERS?.[password]) return res.json({ success: true, type: 'owner', key: password });
  const user = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(password));
  if (user) return res.json({ success: true, type: 'user', key: password, phone: user.phone, name: user.name });
  res.json({ success: false, error: 'Invalid password' });
});

// ═══════════════════════════════════════════════════
//  🚀 API: QUICK DEPLOY
// ═══════════════════════════════════════════════════
app.post("/api/user/quick-deploy", async (req, res) => {
  try {
    const userMgr = require('./user-manager');
    const { phone, name } = req.body || {};
    if (!phone || !name) return res.json({ success: false, error: 'Phone & name required' });
    const cleanPhone = userMgr.cleanPhone(phone);
    if (cleanPhone.length < 10) return res.json({ success: false, error: 'Invalid phone' });

    let user = userMgr.USERS[cleanPhone];
    if (user) {
      if (!user.dashPassword || String(user.dashPassword).length !== 5) {
        user.dashPassword = userMgr.generateUnique5Digit();
        await userMgr.persistUser(user);
      }
      return res.json({ success: true, password: user.dashPassword, sessionId: user.sessionId, existing: true });
    }
    user = {
      phone: cleanPhone, name: name || 'User',
      createdAt: new Date().toISOString(),
      sessionId: userMgr.generateSessionId(),
      dashPassword: userMgr.generateUnique5Digit(),
      status: 'pending', token: null, deployedAt: new Date().toISOString()
    };
    await userMgr.persistUser(user);
    console.log(`🎉 New user: ${cleanPhone} (${name}) [pw: ${user.dashPassword}]`);
    res.json({ success: true, password: user.dashPassword, sessionId: user.sessionId, existing: false });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/user/quick-connect", async (req, res) => {
  try {
    const userMgr = require('./user-manager');
    const { phone, sessionId } = req.body || {};
    const cleanPhone = userMgr.cleanPhone(phone);
    const user = userMgr.USERS[cleanPhone];
    if (!user) return res.json({ success: false, error: 'User not found' });
    const sessId = sessionId || user.sessionId;
    const existing = userMgr.BOT_INSTANCES.get(sessId);
    if (existing && existing.status === 'active') return res.json({ success: true, sessionId: sessId, status: 'active' });
    if (existing && existing.status === 'pairing_code_ready' && existing.pairingCode) return res.json({ success: true, sessionId: sessId });
    // a healthy bot that is just (re)connecting must not be killed by a stranger typing the number: let it settle first
    if (existing && existing.status === 'connecting' && !existing.deadSession && Date.now() - new Date(existing.startedAt).getTime() < 90000) {
      return res.json({ success: true, sessionId: sessId });
    }
    if (existing) {
      // offline / dead / stuck instance: stop it and start a clean pairing (a dead session was already deleted on 401)
      console.log(`♻️ Quick connect: replacing ${existing.status} instance of ${cleanPhone}`);
      try { userMgr.stopUserBot(sessId); } catch (e) {}
    }
    console.log(`🚀 Quick connect: ${cleanPhone}`);
    userMgr.LAST_ERRORS.delete(sessId);
    userMgr.createUserBot(sessId, cleanPhone, global.ownerConn, { usePairingCode: true })
      .catch(e => console.error('❌ Quick connect:', e.stack || e.message));
    res.json({ success: true, sessionId: sessId });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get("/api/user/quick-status", (req, res) => {
  try {
    const userMgr = require('./user-manager');
    const { sessionId } = req.query;
    if (!sessionId) return res.json({ success: false, error: 'sessionId required' });
    const instance = userMgr.BOT_INSTANCES.get(sessionId);
    res.json({
      success: true,
      status: instance?.status || 'offline',
      qr: instance?.qr || null,
      pairingCode: instance?.pairingCode || null,
      pairingCodeError: instance?.pairingCodeError || null,
      debug: instance?.lastEvent || (instance ? null : (userMgr.LAST_ERRORS.get(sessionId) ? 'bot could not start: ' + userMgr.LAST_ERRORS.get(sessionId) : 'no bot instance on the server (it was not created or it was removed)')),
      connectedAt: instance?.connectedAt || null
    });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════
//  ⚙️ USER CONFIG API
// ═══════════════════════════════════════════════════
app.get("/api/user/config", (req, res) => {
  const userMgr = require('./user-manager');
  const key = req.query.key;
  const user = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(key));
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  try { res.json({ success: true, config: loadUserConfig(user.sessionId) }); }
  catch (e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/user/config", (req, res) => {
  const userMgr = require('./user-manager');
  const { key, config: newCfg } = req.body || {};
  const user = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(key));
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const currentFileCfg = loadUserConfig(user.sessionId);
    if (currentFileCfg.ANTI_DELETE_GC !== undefined) newCfg.ANTI_DELETE_GC = currentFileCfg.ANTI_DELETE_GC;
    if (currentFileCfg.ANTI_DELETE_DM !== undefined) newCfg.ANTI_DELETE_DM = currentFileCfg.ANTI_DELETE_DM;

    const old = loadUserConfig(user.sessionId);
    if (old && Object.keys(old).length) fs.writeFileSync(getUserConfigPath(user.sessionId) + '.backup', JSON.stringify(old, null, 2), 'utf8');
    const ok = saveUserConfig(user.sessionId, newCfg);

    const instance = userMgr.BOT_INSTANCES.get(user.sessionId);
    if (instance && instance.conn) {
      if (!instance.conn._userConfig) instance.conn._userConfig = {};
      Object.assign(instance.conn._userConfig, newCfg);
    }
    res.json({ success: ok, error: ok ? undefined : 'Save failed' });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/user/config/reset", (req, res) => {
  const userMgr = require('./user-manager');
  const { key } = req.body || {};
  const user = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(key));
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    let def = {};
    if (fs.existsSync(DEFAULT_PATH)) def = JSON.parse(fs.readFileSync(DEFAULT_PATH, 'utf8'));
    saveUserConfig(user.sessionId, def);

    const instance = userMgr.BOT_INSTANCES.get(user.sessionId);
    if (instance && instance.conn) {
      if (!instance.conn._userConfig) instance.conn._userConfig = {};
      Object.assign(instance.conn._userConfig, def);
    }
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════
//  🔧 OWNER APIs — MongoDB first
// ═══════════════════════════════════════════════════
app.get("/api/config", async (req, res) => {
  const key = req.query.key;
  if (!global.DASHBOARD_USERS?.[key]) return res.status(401).json({ error: 'Unauthorized' });
  try {
    let cfg = await readConfigFromMongo();
    if (!cfg) cfg = readLocalConfig();
    if (!cfg) return res.json({ success: false, error: 'Config not found' });
    res.json({ success: true, config: cfg });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/config", async (req, res) => {
  const { key, config: newCfg } = req.body || {};
  if (!global.DASHBOARD_USERS?.[key]) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const current = readLocalConfig();
    if (current) fs.writeFileSync(BACKUP_PATH, JSON.stringify(current, null, 2), 'utf8');
    await writeConfig(newCfg);
    if (global.ownerConn) {
      if (!global.ownerConn._userConfig) global.ownerConn._userConfig = {};
      Object.assign(global.ownerConn._userConfig, newCfg);
    }
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/config/undo", async (req, res) => {
  const { key } = req.body || {};
  if (!global.DASHBOARD_USERS?.[key]) return res.status(401).json({ error: 'Unauthorized' });
  try {
    let backup = null;
    if (fs.existsSync(BACKUP_PATH)) backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
    if (!backup) return res.json({ success: false, error: 'No backup' });
    const current = readLocalConfig();
    if (current) fs.writeFileSync(BACKUP_PATH, JSON.stringify(current, null, 2), 'utf8');
    await writeConfig(backup);
    if (global.ownerConn) {
      if (!global.ownerConn._userConfig) global.ownerConn._userConfig = {};
      Object.assign(global.ownerConn._userConfig, backup);
    }
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/config/reset", async (req, res) => {
  const { key } = req.body || {};
  if (!global.DASHBOARD_USERS?.[key]) return res.status(401).json({ error: 'Unauthorized' });
  try {
    let def = null;
    if (fs.existsSync(DEFAULT_PATH)) def = JSON.parse(fs.readFileSync(DEFAULT_PATH, 'utf8'));
    if (!def) return res.json({ success: false, error: 'Default not found' });
    const current = readLocalConfig();
    if (current) fs.writeFileSync(BACKUP_PATH, JSON.stringify(current, null, 2), 'utf8');
    await writeConfig(def);
    if (global.ownerConn) {
      if (!global.ownerConn._userConfig) global.ownerConn._userConfig = {};
      Object.assign(global.ownerConn._userConfig, def);
    }
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/restart", (req, res) => {
  const { key } = req.body || {};
  if (!global.DASHBOARD_USERS?.[key]) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ success: true });
  setTimeout(() => process.exit(0), 2000);
});

// ═══════════════════════════════════════════════════
//  🛡️ ANTI-DELETE API
// ═══════════════════════════════════════════════════
app.get("/api/antidelete", (req, res) => {
  const userMgr = require('./user-manager');
  const key = req.query.key;
  if (!key) return res.status(401).json({ error: 'Unauthorized' });

  const isOwner = !!global.DASHBOARD_USERS?.[key];
  const user = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(key));
  if (!isOwner && !user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (isOwner) {
      const gc = (typeof getAnti === 'function') ? getAnti('gc') : false;
      const dm = (typeof getAnti === 'function') ? getAnti('dm') : false;
      return res.json({ success: true, gc, dm, scope: 'global' });
    }
    const cfg = loadUserConfig(user.sessionId);
    const gc = String(cfg.ANTI_DELETE_GC) === 'true';
    const dm = String(cfg.ANTI_DELETE_DM) === 'true';
    return res.json({ success: true, gc, dm, scope: 'user' });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/antidelete", async (req, res) => {
  const userMgr = require('./user-manager');
  const { key, action } = req.body || {};
  if (!key) return res.status(401).json({ error: 'Unauthorized' });

  const isOwner = !!global.DASHBOARD_USERS?.[key];
  const user = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(key));
  if (!isOwner && !user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (isOwner) {
      if (typeof setAnti !== 'function' || typeof getAnti !== 'function') {
        return res.json({ success: false, error: 'Not available' });
      }
      switch (action) {
        case 'set_all': setAnti('gc', true); setAnti('dm', true); break;
        case 'off_all': setAnti('gc', false); setAnti('dm', false); break;
        case 'toggle_gc': setAnti('gc', !getAnti('gc')); break;
        case 'toggle_dm': setAnti('dm', !getAnti('dm')); break;
        default: return res.json({ success: false, error: 'Invalid' });
      }
      return res.json({ success: true, gc: getAnti('gc'), dm: getAnti('dm'), scope: 'global' });
    }

    const cfg = loadUserConfig(user.sessionId);
    let gc = String(cfg.ANTI_DELETE_GC) === 'true';
    let dm = String(cfg.ANTI_DELETE_DM) === 'true';

    switch (action) {
      case 'set_all': gc = true; dm = true; break;
      case 'off_all': gc = false; dm = false; break;
      case 'toggle_gc': gc = !gc; break;
      case 'toggle_dm': dm = !dm; break;
      default: return res.json({ success: false, error: 'Invalid' });
    }

    cfg.ANTI_DELETE_GC = gc ? 'true' : 'false';
    cfg.ANTI_DELETE_DM = dm ? 'true' : 'false';
    saveUserConfig(user.sessionId, cfg);

    const instance = userMgr.BOT_INSTANCES.get(user.sessionId);
    if (instance && instance.conn) {
      if (!instance.conn._userConfig) instance.conn._userConfig = {};
      instance.conn._userConfig.ANTI_DELETE_GC = cfg.ANTI_DELETE_GC;
      instance.conn._userConfig.ANTI_DELETE_DM = cfg.ANTI_DELETE_DM;
    }

    res.json({ success: true, gc, dm, scope: 'user' });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════
//  🛡️ ANTILINK API — MongoDB first
// ═══════════════════════════════════════════════════
app.get("/api/antilink", async (req, res) => {
  const userMgr = require('./user-manager');
  const key = req.query.key;
  if (!key) return res.status(401).json({ error: 'Unauthorized' });

  const isOwner = !!global.DASHBOARD_USERS?.[key];
  const user = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(key));
  if (!isOwner && !user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let cfg;
    if (isOwner) {
      cfg = await readConfigFromMongo();
      if (!cfg) cfg = readLocalConfig();
      if (!cfg) cfg = config._base || {};
    } else {
      const p = path.join(USER_CONFIGS_DIR, `${user.sessionId}.json`);
      if (fs.existsSync(p)) {
        cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
      } else {
        cfg = loadUserConfig(user.sessionId);
      }
    }

    const enabled = String(cfg.ANTI_LINK_ENABLED !== undefined ? cfg.ANTI_LINK_ENABLED : cfg.ANTI_LINK || 'false') === 'true';
    const whitelistEnabled = String(cfg.ANTI_LINK_WHITELIST_ENABLED !== undefined ? cfg.ANTI_LINK_WHITELIST_ENABLED : 'true') === 'true';

    res.json({
      success: true,
      enabled,
      action: cfg.ANTI_LINK_ACTION || 'delete',
      warnLimit: cfg.ANTI_LINK_WARN_LIMIT || '3',
      whitelist: cfg.ANTI_LINK_WHITELIST || 'whatsapp.com,youtube.com,github.com',
      whitelistEnabled,
      notify: String(cfg.ANTI_LINK_NOTIFY || 'true') === 'true',
      skipAdmins: String(cfg.ANTI_LINK_SKIP_ADMINS || 'true') === 'true',
      skipBot: String(cfg.ANTI_LINK_SKIP_BOT || 'true') === 'true',
      scope: isOwner ? 'owner' : 'user'
    });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/antilink", async (req, res) => {
  const userMgr = require('./user-manager');
  const { key, enabled, action, warnLimit, whitelist, whitelistEnabled, notify, skipAdmins, skipBot } = req.body || {};
  if (!key) return res.status(401).json({ error: 'Unauthorized' });

  const isOwner = !!global.DASHBOARD_USERS?.[key];
  const user = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(key));
  if (!isOwner && !user) return res.status(401).json({ error: 'Unauthorized' });

  const patch = {
    ANTI_LINK_ENABLED: enabled ? 'true' : 'false',
    ANTI_LINK_ACTION: ['delete','warn','kick'].includes(action) ? action : 'delete',
    ANTI_LINK_WARN_LIMIT: String(parseInt(warnLimit, 10) || 3),
    ANTI_LINK_WHITELIST: String(whitelist || '').trim(),
    ANTI_LINK_WHITELIST_ENABLED: whitelistEnabled !== false ? 'true' : 'false',
    ANTI_LINK_NOTIFY: notify ? 'true' : 'false',
    ANTI_LINK_SKIP_ADMINS: skipAdmins ? 'true' : 'false',
    ANTI_LINK_SKIP_BOT: skipBot !== false ? 'true' : 'false'
  };

  try {
    if (isOwner) {
      await writeConfig(patch);
      if (global.ownerConn) {
        if (!global.ownerConn._userConfig) global.ownerConn._userConfig = {};
        Object.assign(global.ownerConn._userConfig, patch);
      }
      console.log('💾 [OWNER] Antilink saved:', Object.keys(patch).join(', '));
      return res.json({ success: true, scope: 'owner' });
    }

    const cur = loadUserConfig(user.sessionId);
    const next = { ...cur, ...patch };
    const ok = saveUserConfig(user.sessionId, next);

    const instance = userMgr.BOT_INSTANCES.get(user.sessionId);
    if (instance && instance.conn) {
      if (!instance.conn._userConfig) instance.conn._userConfig = {};
      Object.assign(instance.conn._userConfig, patch);
    }

    res.json({ success: ok, scope: 'user' });
  } catch (e) {
    console.error('❌ [/api/antilink]', e.message);
    res.json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════
//  🔍 DEBUG ENDPOINT
// ═══════════════════════════════════════════════════
app.get("/api/debug/config", async (req, res) => {
  const key = req.query.key;
  if (!global.DASHBOARD_USERS?.[key]) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const mongo = require('./lib/mongo');
    const diskCfg = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) : null;
    const mongoCfg = mongo.isConnected() ? await mongo.getConfig() : null;

    res.json({
      path: CONFIG_PATH,
      disk: {
        exists: fs.existsSync(CONFIG_PATH),
        keys: diskCfg ? Object.keys(diskCfg).length : 0,
        ANTI_LINK_ENABLED: diskCfg?.ANTI_LINK_ENABLED,
        ANTI_LINK_WHITELIST_ENABLED: diskCfg?.ANTI_LINK_WHITELIST_ENABLED,
        ANTI_LINK_ACTION: diskCfg?.ANTI_LINK_ACTION
      },
      mongo: {
        connected: mongo.isConnected(),
        keys: mongoCfg ? Object.keys(mongoCfg).length : 0,
        ANTI_LINK_ENABLED: mongoCfg?.ANTI_LINK_ENABLED,
        ANTI_LINK_WHITELIST_ENABLED: mongoCfg?.ANTI_LINK_WHITELIST_ENABLED,
        ANTI_LINK_ACTION: mongoCfg?.ANTI_LINK_ACTION
      }
    });
  } catch (e) { res.json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════
//  👥 ADMIN USERS
// ═══════════════════════════════════════════════════
app.get('/api/admin/users', (req, res) => {
  const userMgr = require('./user-manager');
  const key = req.query.key;
  if (!global.DASHBOARD_USERS?.[key]) return res.status(401).json({ error: 'Unauthorized' });
  const users = Object.values(userMgr.USERS).map(u => {
    const inst = userMgr.BOT_INSTANCES.get(u.sessionId);
    return {
      phone: u.phone, name: u.name, createdAt: u.createdAt,
      botStatus: inst?.status || 'stopped',
      sessionId: u.sessionId, dashPassword: u.dashPassword
    };
  });
  res.json({ success: true, users });
});

app.post('/api/admin/remove-user', async (req, res) => {
  try {
    const userMgr = require('./user-manager');
    const { key, phone } = req.body || {};
    if (!global.DASHBOARD_USERS?.[key]) return res.status(401).json({ error: 'Unauthorized' });
    if (!phone) return res.json({ success: false, error: 'Phone required' });
    const result = await userMgr.removeUser(phone);
    res.json({ success: true, ...result });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════
//  🔗 OWNER PAIRING (dashboard key required)
// ═══════════════════════════════════════════════════
app.get("/api/owner/pairing", (req, res) => {
  if (!global.DASHBOARD_USERS?.[req.query.key]) return res.status(401).json({ error: 'Unauthorized' });
  res.json({
    success: true,
    connected: botStatus.connected,
    pairing: ownerPairWanted,
    number: botStatus.connected ? botStatus.user?.split(':')[0] : (ownerPairNumber || String(config.OWNER_NUMBER)),
    pairingCode: botStatus.connected ? null : botStatus.pairingCode,
    pairingError: botStatus.pairingError || null,
    timeoutMin: PAIR_TIMEOUT_MIN
  });
});

app.post("/api/owner/pair", async (req, res) => {
  const { key, number } = req.body || {};
  if (!global.DASHBOARD_USERS?.[key]) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await startOwnerPairing(number);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/owner/pair/cancel", (req, res) => {
  const { key } = req.body || {};
  if (!global.DASHBOARD_USERS?.[key]) return res.status(401).json({ error: 'Unauthorized' });
  endOwnerPairing('Cancelled');
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════
//  📊 STATUS
// ═══════════════════════════════════════════════════
app.get("/status", (req, res) => {
  const userMgr = require('./user-manager');
  const mongo = require('./lib/mongo');
  const uptime = Math.floor((Date.now() - BOT_START_TIME) / 1000);
  res.json({
    status: botStatus.connected ? "online" : "offline",
    bot: config.BOT_NAME, owner: config.OWNER_NAME, version: "3.0.0",
    user: botStatus.user,
    uptime, uptimeFormatted: formatUptime(uptime),
    startedAt: new Date(BOT_START_TIME).toISOString(),
    lastUpdate: botStatus.lastUpdate,
    domain: global.BOT_DOMAIN,
    database: { type: mongo.isConnected() ? 'mongodb' : 'file', connected: mongo.isConnected() },
    users: { total: Object.keys(userMgr.USERS).length, activeBots: userMgr.BOT_INSTANCES.size },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB"
    },
    system: { platform: process.platform, node: process.version, cpu: os.cpus()[0]?.model || "Unknown", hostname: os.hostname() },
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════
//  🔌 OWNER WHATSAPP CONNECTION
// ═══════════════════════════════════════════════════
async function connectToWA() {
  if (ownerConnecting) return;
  if (ownerConn && botStatus.connected) return;

  ownerConnecting = true;
  console.log("Connecting ⏳...");
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
      logger: P({ level: process.env.LOG_LEVEL || 'error' }),   // 'error' shows decrypt / socket problems
      printQRInTerminal: false,
      browser: Browsers.macOS("Firefox"),
      syncFullHistory: false,
      auth: state,
      version,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 250,
      generateHighQualityLinkPreview: false
    });

    ownerSock = conn;
    if (!ownerSync) ownerSync = authSync.start(OWNER_SESSION_KEY, sessionsDir);

    // ── Pairing code — only after the owner asked for it on the dashboard ──
    let pairingRequested = false;
    const requestOwnerPairing = async () => {
      if (!ownerPairWanted || pairingRequested || conn.authState?.creds?.registered) return;
      pairingRequested = true;
      const num = ownerPairNumber;
      if (!num) { botStatus.pairingError = 'Number not set'; return; }
      try {
        // default code (FIXOMODZ) like your other bots; PAIRING_CODE env/config can override
        const code = await requestValidPairingCode(conn, num);
        botStatus.pairingCode = code;
        botStatus.pairingError = null;
        console.log('\n══════════════════════════════════════════');
        console.log(`🔢 PAIRING CODE for ${num}:  ${code}`);
        console.log('   WhatsApp > Linked devices > Link with phone number');
        console.log('══════════════════════════════════════════\n');
      } catch (e) {
        pairingRequested = false;
        botStatus.pairingError = e.message;
        console.log('❌ Pairing code error:', e.message);
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
        const reason = lastDisconnect?.error?.output?.payload?.message || '';
        console.log(`🔄 Closed — ${statusCode} ${reason}`);

        if (conn._noReconnect) return;                       // closed on purpose (pairing cancelled / expired)

        // pairing in progress: only the normal "restart required" after a successful link may reconnect
        if (ownerPairWanted && statusCode !== 515 && statusCode !== DisconnectReason.restartRequired) {
          endOwnerPairing(`Connection closed before linking (${statusCode}). Generate a new code.`);
          return;
        }

        if (statusCode === 401 || statusCode === DisconnectReason.loggedOut) {
          // Logged out / device removed: the session is useless — delete it and wait. NO automatic pairing code.
          console.log('🚪 Logged out — session deleted. Open the dashboard to link again.');
          botStatus.pairingCode = null;
          await wipeOwnerSession();
          return;
        }
        
        if (statusCode === 440) {
          setTimeout(() => { ownerConn = null; connectToWA(); }, 5 * 60 * 1000);
          return;
        }

        if (statusCode === 515 || statusCode === DisconnectReason.restartRequired) {
          // normal right after pairing — reconnect quickly
          setTimeout(() => { ownerConn = null; connectToWA(); }, 2000);
          return;
        }

        if ([402, 403, 500].includes(statusCode)) return;

        setTimeout(() => { ownerConn = null; connectToWA(); }, 30000);

      } else if (connection === 'open') {
        ownerConnecting = false;
        botStatus.connected = true;
        botStatus.user = conn.user.id;
        botStatus.qr = null;
        botStatus.pairingCode = null;
        botStatus.pairingError = null;
        if (ownerPairTimer) { clearTimeout(ownerPairTimer); ownerPairTimer = null; }
        ownerPairWanted = false;
        console.log('✅ Owner connected');
        ownerConn = conn;
        global.ownerConn = conn;

        const mongoCfg = await readConfigFromMongo();
        // defaults first, saved config (Mongo / config.json) on top
        conn._userConfig = { ...(config._base || {}), ...(mongoCfg || readLocalConfig() || {}) };


        try {
          const events = require('./command');
          events.loadPlugins();
        } catch (e) {}

        attachConnHelpers(conn);
        setupBotCommands(conn, { isOwnerBot: true, userInfo: null });

        // 🎯 AUTO JOIN — every configured channel (main + extras). Runs in background so it can never delay commands.
        handleAutoJoin(conn, conn._userConfig).catch(e => console.log('❌ Auto-Join error:', e.message));

        setTimeout(() => {
          sendConnectedMessage(conn, true, null).catch(e => {});
        }, 15000);

        if (String(config.ALWAYS_ONLINE) === 'true') {
          try { await conn.sendPresenceUpdate('available'); } catch (e) {}
          setInterval(async () => {
            try { if (botStatus.connected) await conn.sendPresenceUpdate('available'); } catch (e) {}
          }, 30000);
        }

        setTimeout(() => {
          const userMgr = require('./user-manager');
          userMgr.restoreAllSessions(conn).catch(e => console.error('Restore:', e.message));
        }, 8000);
      }
    });

    conn.ev.on('creds.update', async () => {
      await saveCreds();
      backupOwnerCreds();
      backupOwnerCredsToMongo();            // legacy creds-only copy
      if (ownerSync) ownerSync.flush();     // full session folder -> MongoDB (only once really linked)
    });

  } catch (e) {
    ownerConnecting = false;
    console.log('❌ connectToWA error:', e.message);
    setTimeout(() => { ownerConn = null; connectToWA(); }, 30000);
  }
}

// ═══════════════════════════════════════════════════
//  🚀 STARTUP
// ═══════════════════════════════════════════════════
app.listen(port, () => console.log(`🌐 http://localhost:${port}`));

(async () => {
  console.log(`🚀 ${config.BOT_NAME} starting...`);

  // Load every plugin/command at startup. This used to happen only after the OWNER bot connected, so with no owner
  // session (user bots only) the command list stayed empty and nothing ever replied.
  try { require('./command').loadPlugins(); } catch (e) { console.error('❌ Plugin load failed:', e.stack || e.message); }

  const mongo = require('./lib/mongo');
  const userMgr = require('./user-manager');

  try {
    const mongoConn = await mongo.connectMongo();
    if (mongoConn) {
      console.log('✅ MongoDB ready');
      const mongoCfg = await mongo.getConfig();
      if (mongoCfg && Object.keys(mongoCfg).length > 0) {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(mongoCfg, null, 2), 'utf8');
        if (typeof config._reload === 'function') config._reload();
      }
      await userMgr.loadUsers();
      userMgr.cleanupUnlinked().catch(() => {});   // drop numbers that never linked
    }
  } catch (e) {
    console.log('❌ MongoDB error:', e.message);
  }

  const hasOwnerSession = await ensureOwnerSession();

  if (hasOwnerSession) {
    setTimeout(() => {
      connectToWA().catch(e => console.log('❌ Initial connect failed:', e.message));
    }, 8000);
  } else {
    // Owner not linked: do NOT connect (that is what used to push a "link device" code to the phone on every start).
    // User bots that already have a real session still come back.
    setTimeout(() => {
      userMgr.restoreAllSessions(null).catch(e => console.error('Restore:', e.message));
    }, 8000);
  }
})();

let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🔌 ${signal} received — closing...`);
  try {
    if (global.ownerConn) {
      try { global.ownerConn.end(undefined); } catch (e) {}
    }
    const m = require('./lib/mongo');
    await m.closeMongo();
  } catch (e) {}
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

let lastNoise = 0;
function logProcessError(tag, msg, stack) {
  // decrypt / Bad MAC errors are common noise, but never hide them completely (print at most once / 20s)
  if (msg.includes('Bad MAC') || msg.includes('decrypt')) {
    if (Date.now() - lastNoise < 20000) return;
    lastNoise = Date.now();
  }
  console.log(`❌ ${tag}:`, msg, process.env.DEBUG_MSG !== 'false' && stack ? '\n' + String(stack).split('\n').slice(1, 4).join('\n') : '');
}
process.on('uncaughtException', (err) => logProcessError('Uncaught', String(err?.message || err), err?.stack));
process.on('unhandledRejection', (reason) => logProcessError('Unhandled', String(reason?.message || reason || ''), reason?.stack));
