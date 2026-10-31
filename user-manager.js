/*
   ██████╗  █████╗ ████████╗██╗  ██╗██╗   ██╗███╗   ███╗     ████████╗███████╗ ██████╗██╗  ██╗
   ██╔══██╗██╔══██╗╚══██╔══╝██║  ██║██║   ██║████╗ ████║     ╚══██╔══╝██╔════╝██╔════╝██║  ██║
   ██████╔╝███████║   ██║   ███████║██║   ██║██╔████╔██║        ██║   █████╗  ██║     ███████║
   ██╔═══╝ ██╔══██║   ██║   ██╔══██║██║   ██║██║╚██╔╝██║        ██║   ██╔══╝  ██║     ██╔══██║
   ██║     ██║  ██║   ██║   ██║  ██║╚██████╔╝██║ ╚═╝ ██║        ██║   ███████╗╚██████╗██║  ██║
   ╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝        ╚═╝   ╚══════╝ ╚═════╝╚═╝  ╚═╝
        
                    ⚡ PATHUMTECH — WhatsApp Bot ⚡

    🛡️  WARNING — DO NOT REMOVE THIS CREDIT HEADER 🛡️
    ❌ ඉවත් කිරීම තහනම් | Removing credits is STRICTLY PROHIBITED

    📛 Original Author : PathumTech
    📅 Created         : 2024
    📦 Version         : 3.0.0
    🌐 Platform        : WhatsApp (Baileys Multi-Device)
    ⚙️  Framework       : fixo-baileys

    📜  LICENSE & CREDIT NOTICE
    මෙම code එක PathumTech විසින් නිර්මාණය කරන ලදී.
    ඔබට මෙය edit කරන්න, වෙනස් කරන්න සහ භාවිතා කරන්න අවසර ඇත.
    නමුත් මෙම CREDIT HEADER එක ඉවත් කිරීම හෝ වෙනස් කිරීම
    සම්පූර්ණයෙන්ම තහනම් වේ. 🚫

    You are ALLOWED to :
      ✅ Use this code for personal & commercial purposes
      ✅ Modify, edit, and improve the code
      ✅ Share with friends (with credit intact)

    You are NOT ALLOWED to :
      ❌ Remove this credit header
      ❌ Claim this code as your own work
      ❌ Sell or redistribute without credit
      ❌ Change the author name to someone else

    📞  CONTACT
    👤  Owner      : Pathum Malsara
    📱  WhatsApp   : +94 77 341 6478
    📱  Support    : +94 76 106 8032
    📱  Support    : +94 72 397 5388
    🌐  GitHub     : github.com/pathumtech
    📺  YouTube    : @pathumtech

    ⚠️  LEGAL WARNING
    මෙම credit header එක ඉවත් කර, නැවත distribute කිරීම හෝ
    වෙනත් අයෙකුගේ නමින් පළ කිරීම —
    intellectual property theft (බුද්ධිමය දේපළ සොරකමක්) වේ.

    Credits removed = License terminated = No support = No updates

    © 2024 - 2026 PathumTech. All Rights Reserved.
*/


const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const P = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('fixo-baileys');

const config = require('./config');
const authSync = require('./lib/authSync');
const { requestValidPairingCode } = require('./lib/pairing');
let mongo = null;
try { mongo = require('./lib/mongo'); } catch (e) { mongo = null; }

const DATA_DIR = process.env.DATA_DIR || __dirname;
const USERS_FILE = path.join(DATA_DIR, 'data', 'users.json');
const USER_SESSIONS_DIR = path.join(DATA_DIR, 'user-sessions');
const USER_CONFIGS_DIR = path.join(DATA_DIR, 'user-configs');

[DATA_DIR, path.join(DATA_DIR, 'data'), USER_SESSIONS_DIR, USER_CONFIGS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const USERS = {};
const BOT_INSTANCES = new Map();
const LAST_ERRORS = new Map();   // sessionId -> why createUserBot failed

// Numbers that asked for a pairing code but never linked are removed after this time.
const PAIR_TIMEOUT_MS = (parseInt(process.env.PAIR_TIMEOUT_MIN || config.PAIR_TIMEOUT_MIN || '10', 10) || 10) * 60 * 1000;
// A deployed user record that never even started pairing is kept longer.
const PENDING_USER_TTL_MS = Math.max(PAIR_TIMEOUT_MS, 60 * 60 * 1000);

function cleanPhone(phone) { if (!phone) return ''; return String(phone).replace(/[^0-9]/g, '').trim(); }
function generateSessionId() { return 'sess_' + crypto.randomBytes(8).toString('hex'); }
function generateToken() { return crypto.randomBytes(24).toString('hex'); }
function generateOTP() { return String(Math.floor(100000 + Math.random() * 900000)); }
function generateDashPassword() { return String(Math.floor(10000 + Math.random() * 90000)); }

function generateUnique5Digit() {
  const used = new Set();
  try { if (global.DASHBOARD_USERS) Object.keys(global.DASHBOARD_USERS).forEach(pw => used.add(String(pw))); } catch (e) {}
  try { Object.values(USERS || {}).forEach(u => { if (u && u.dashPassword) used.add(String(u.dashPassword)); }); } catch (e) {}
  let code, attempts = 0;
  do { code = String(Math.floor(10000 + Math.random() * 90000)); attempts++; }
  while (used.has(code) && attempts < 500);
  return code;
}

function getUserSessionDir(sessionId) {
  const dir = path.join(USER_SESSIONS_DIR, sessionId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function getUserConfigPath(sessionId) { return path.join(USER_CONFIGS_DIR, `${sessionId}.json`); }

function loadUserConfig(sessionId) {
  try {
    const p = getUserConfigPath(sessionId);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    const defPath = path.join(DATA_DIR, 'config.default.json');
    if (fs.existsSync(defPath)) return JSON.parse(fs.readFileSync(defPath, 'utf8'));
    return {};
  } catch (e) { return {}; }
}
function saveUserConfig(sessionId, cfg) {
  try { fs.writeFileSync(getUserConfigPath(sessionId), JSON.stringify(cfg, null, 2), 'utf8'); return true; }
  catch (e) { return false; }
}
function saveUsersToFile() {
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(USERS, null, 2), 'utf8'); } catch (e) {}
}

async function loadUsers() {
  console.log('👥 Loading users...');
  if (mongo && typeof mongo.isConnected === 'function' && mongo.isConnected()) {
    try {
      if (typeof mongo.getAllUsers === 'function') {
        const mongoUsers = await mongo.getAllUsers();
        if (mongoUsers && mongoUsers.length) {
          for (const u of mongoUsers) if (u && u.phone) USERS[u.phone] = u;
          console.log(`👥 Loaded ${mongoUsers.length} from MongoDB`);
          try { saveUsersToFile(); } catch (e) {}
          return;
        }
      }
    } catch (e) { console.warn('⚠️ Mongo:', e.message); }
  }
  try {
    if (fs.existsSync(USERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      for (const [phone, u] of Object.entries(parsed || {})) if (u && u.phone) USERS[phone] = u;
      console.log(`👥 Loaded ${Object.keys(USERS).length} from file`);
    }
  } catch (e) {}
}

async function persistUser(user) {
  if (!user || !user.phone) return;
  USERS[user.phone] = user;
  try { saveUsersToFile(); } catch (e) {}
  if (mongo && typeof mongo.isConnected === 'function' && mongo.isConnected()) {
    try { await mongo.saveUser(user); } catch (e) {}
  }
}

async function sendOTP(ownerConn, phone, otp) {
  if (!ownerConn) return { sent: false, error: 'No owner' };
  try {
    const jid = cleanPhone(phone) + '@s.whatsapp.net';
    await ownerConn.sendMessage(jid, { text: `🔐 OTP: *${otp}*` });
    return { sent: true };
  } catch (e) { return { sent: false, error: e.message }; }
}

// ══════════════════════════════════════════════════════════════
// 🤖 CREATE USER BOT
// ══════════════════════════════════════════════════════════════
async function createUserBot(sessionId, phone, ownerConn, options = {}) {
  const { usePairingCode = false } = options;
  if (BOT_INSTANCES.has(sessionId)) throw new Error('Already running');

  const instance = {
    sessionId, phone, conn: null, status: 'connecting',
    qr: null, pairingCode: null, pairingCodeError: null,
    startedAt: new Date().toISOString(), connectedAt: null, stopRequested: false
  };
  BOT_INSTANCES.set(sessionId, instance);

  const sessionDir = getUserSessionDir(sessionId);

  // A pairing attempt must start from an EMPTY session. A half-finished earlier attempt leaves creds with `me` set but
  // `registered:false`; the socket then tries to log in with it, gets 401 and never produces a pairing code.
  if (usePairingCode && !authSync.isRegistered(sessionDir)) {
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); fs.mkdirSync(sessionDir, { recursive: true }); } catch (e) {}
    try { await authSync.remove(sessionId); if (mongo && mongo.isConnected()) await mongo.deleteSession(sessionId); } catch (e) {}
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
      logger: P({ level: process.env.LOG_LEVEL || 'error' }),
      printQRInTerminal: false,
      browser: Browsers.macOS('Firefox'),
      syncFullHistory: false,
      auth: state, version
    });

    // short status line that the /freebot page can show, and the same line in the server log
    const dbg = (m) => { instance.lastEvent = `${new Date().toISOString().slice(11, 19)} ${m}`; console.log(`[${phone}] ${m}`); };
    dbg('socket created');

    instance.conn = conn;
    instance.sync = authSync.start(sessionId, sessionDir);   // whole session folder -> MongoDB (only when really linked)

    // ⚡ Set user info
    conn._userInfo = {
      phone: phone,
      sessionId: sessionId,
      name: (USERS[phone] && USERS[phone].name) || 'User'
    };

    // ⚡ Load user's own config
    try {
      const userCfgPath = path.join(USER_CONFIGS_DIR, `${sessionId}.json`);
      if (fs.existsSync(userCfgPath)) {
        conn._userConfig = JSON.parse(fs.readFileSync(userCfgPath, 'utf8'));
        console.log(`📋 Config loaded for ${phone} (${Object.keys(conn._userConfig).length} keys)`);
      } else {
        const defPath = path.join(DATA_DIR, 'config.default.json');
        if (fs.existsSync(defPath)) {
          conn._userConfig = JSON.parse(fs.readFileSync(defPath, 'utf8'));
        } else {
          conn._userConfig = {};
        }
        console.log(`📋 Default config for ${phone}`);
      }
    } catch (e) {
      conn._userConfig = {};
      console.error(`Config error ${phone}:`, e.message);
    }

    // Pairing code — requested as soon as WhatsApp says the socket is ready (first `qr` event), with a timer as fallback
    let pairRequested = false;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const waitSocketOpen = async (ms) => {
      const t0 = Date.now();
      // conn.ws.isOpen exists in fixo-baileys; if it does not, just go ahead
      while (conn.ws && typeof conn.ws.isOpen === 'boolean' && !conn.ws.isOpen && Date.now() - t0 < ms) await sleep(300);
    };
    const requestPairing = async () => {
      if (!usePairingCode || pairRequested || instance.stopRequested || conn.authState?.creds?.registered) return;
      pairRequested = true;
      // Retry: the first attempt can arrive before the WhatsApp websocket is open ("Connection Closed")
      for (let attempt = 1; attempt <= 6 && !instance.stopRequested && instance.status !== 'active'; attempt++) {
        try {
          await waitSocketOpen(20000);
          const code = await requestValidPairingCode(conn, phone);
          instance.pairingCode = code;
          instance.pairingCodeError = null;
          instance.status = 'pairing_code_ready';
          dbg(`pairing code ready: ${code}`);
          return;
        } catch (e) {
          instance.pairingCodeError = e.message;
          dbg(`pairing code attempt ${attempt}/6 failed: ${e.message}`);
          await sleep(2500 * attempt);
        }
      }
      pairRequested = false;   // gave up — a later qr event / retry may try again
    };
    // NOTE: the code is NOT requested on a timer. fixo-baileys picks "register" or "login" right after the handshake by
    // checking creds.me, and requestPairing() sets creds.me — asking even a moment too early turns the connection into a
    // login attempt (401 -> bot offline, no code). The `qr` event is only emitted once registration has been accepted.
    let pairWatchdog = null;
    if (usePairingCode) {
      pairWatchdog = setTimeout(() => {
        if (!pairRequested && !instance.stopRequested && instance.status !== 'active') {
          instance.status = 'offline';
          instance.pairingCodeError = 'WhatsApp did not answer the pairing handshake in time. Retrying…';
          dbg('no pairing handshake within 25s');
          try { conn.end(undefined); } catch (e) {}
        }
      }, 25000);
    }

    conn.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (connection || qr) dbg(`connection.update: ${connection || '-'}${qr ? ' (qr)' : ''}${connection === 'close' ? ' code=' + (lastDisconnect?.error?.output?.statusCode || '?') + ' ' + (lastDisconnect?.error?.message || '') : ''}`);

      if (qr) { if (pairWatchdog) { clearTimeout(pairWatchdog); pairWatchdog = null; } instance.qr = qr; if (!usePairingCode) instance.status = 'qr_ready'; requestPairing(); }

      if (connection === 'open') {
        instance.status = 'active';
        instance.qr = null;
        instance.pairingCode = null;
        instance.connectedAt = new Date().toISOString();
        console.log(`✅ User bot ${phone} connected`);

        const user = USERS[phone];
        if (user) { user.status = 'active'; user.connectedAt = instance.connectedAt; await persistUser(user); }

        setTimeout(() => {
          if (typeof global.sendConnectedMessage === 'function') {
            global.sendConnectedMessage(conn, false, conn._userInfo).catch(e => {});
          }
        }, 10000);
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (pairWatchdog) { clearTimeout(pairWatchdog); pairWatchdog = null; }
        if (instance.stopRequested) { instance.status = 'stopped'; return; }
        if (code === DisconnectReason.loggedOut || code === 401) {
          // 401 = WhatsApp says this linked device no longer exists (removed from the phone / logged out).
          // The saved session is dead: delete it everywhere, otherwise every restart and every retry reuses it and fails again
          // (that is why no new pairing code was ever requested).
          instance.status = 'offline';
          instance.deadSession = true;
          instance.pairingCode = null;
          instance.pairingCodeError = 'WhatsApp removed this linked device (401). The old session was deleted — a new code will be requested.';
          dbg('401 logged out — deleting the dead session');
          await discardSession(sessionId, sessionDir, phone, instance);
          return;
        }
        if (code === 440) { instance.status = 'offline'; return; }
        // pairing not finished: do not silently recreate the bot (that throws the code away) — report it
        if (usePairingCode && !authSync.isRegistered(sessionDir) && code !== 515 && code !== DisconnectReason.restartRequired) {
          instance.status = 'offline';
          instance.pairingCode = null;
          instance.pairingCodeError = `Connection closed before linking (${code || 'unknown'})`;
          console.log(`🔌 ${phone} pairing connection closed (${code}) — waiting for retry`);
          return;
        }
        instance.status = 'connecting';
        console.log(`🔄 ${phone} reconnecting...`);
        setTimeout(() => {
          if (!instance.stopRequested && BOT_INSTANCES.has(sessionId)) reconnectUserBot(sessionId);
        }, 5000);
      }
    });

    // 💾 Session save
    conn.ev.on('creds.update', async () => {
      await saveCreds();
      try { instance.sync && instance.sync.flush(); } catch (e) {}
      try {
        if (mongo && typeof mongo.isConnected === 'function' && mongo.isConnected() && typeof mongo.saveSession === 'function' && authSync.isRegistered(sessionDir)) {
          const credsPath = path.join(sessionDir, 'creds.json');
          if (fs.existsSync(credsPath)) {
            await mongo.saveSession(sessionId, fs.readFileSync(credsPath, 'utf8')).catch(() => {});
          }
        }
      } catch (e) {}
    });

    // ⚠️ Anti-delete handler දැන් setupBotCommands එකේ තියෙනවා
    // මෙතන තියෙන duplicate එක අයින් කරා ❌

    // ⚡ Setup commands (anti-delete handler included)
    if (typeof global.setupBotCommands === 'function') {
      global.setupBotCommands(conn, { isOwnerBot: false, userInfo: conn._userInfo });
    }

    // ⚡ Setup helpers
    if (typeof global.attachConnHelpers === 'function') {
      global.attachConnHelpers(conn);
    }

    return instance;
  } catch (e) {
    LAST_ERRORS.set(sessionId, e.message);     // shown on /freebot instead of a silent "offline"
    BOT_INSTANCES.delete(sessionId);
    throw e;
  }
}

/** Remove a session that WhatsApp no longer accepts (local folder, full Mongo copy, legacy creds). The user record stays. */
async function discardSession(sessionId, sessionDir, phone, instance) {
  try { instance && instance.sync && instance.sync.stop(); } catch (e) {}
  try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
  try { await authSync.remove(sessionId); } catch (e) {}
  try { if (mongo && typeof mongo.isConnected === 'function' && mongo.isConnected() && typeof mongo.deleteSession === 'function') await mongo.deleteSession(sessionId); } catch (e) {}
  const user = USERS[phone];
  if (user) { user.status = 'offline'; try { await persistUser(user); } catch (e) {} }
  console.log(`🗑️ Dead session of ${phone} deleted`);
}

async function reconnectUserBot(sessionId) {
  const old = BOT_INSTANCES.get(sessionId);
  if (!old) return;
  const phone = old.phone;
  try { if (old.conn) old.conn.end(); } catch (e) {}
  BOT_INSTANCES.delete(sessionId);
  try { await createUserBot(sessionId, phone, global.ownerConn, { usePairingCode: false }); }
  catch (e) { console.error(`Reconnect ${phone}:`, e.message); }
}

function stopUserBot(sessionId) {
  const instance = BOT_INSTANCES.get(sessionId);
  if (!instance) return false;
  instance.stopRequested = true;
  try { instance.sync && instance.sync.stop(); } catch (e) {}
  try { if (instance.conn) instance.conn.end(); } catch (e) {}
  instance.status = 'stopped';
  BOT_INSTANCES.delete(sessionId);
  return true;
}

async function unlinkUserBot(sessionId) {
  const instance = BOT_INSTANCES.get(sessionId);
  if (instance && instance.conn) {
    try { await instance.conn.logout(); } catch (e) {}
    try { instance.conn.end(); } catch (e) {}
  }
  if (instance) instance.stopRequested = true;
  try { instance && instance.sync && instance.sync.stop(); } catch (e) {}
  try { await authSync.remove(sessionId); } catch (e) {}
  BOT_INSTANCES.delete(sessionId);

  const sessionDir = path.join(USER_SESSIONS_DIR, sessionId);
  try { if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
  try {
    if (mongo && typeof mongo.isConnected === 'function' && mongo.isConnected() && typeof mongo.deleteSession === 'function') {
      await mongo.deleteSession(sessionId);
    }
  } catch (e) {}
  try {
    const cfgPath = getUserConfigPath(sessionId);
    if (fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath);
    if (fs.existsSync(cfgPath + '.backup')) fs.unlinkSync(cfgPath + '.backup');
  } catch (e) {}
  return true;
}

async function removeUser(phone) {
  const cleanNum = cleanPhone(phone);
  const user = USERS[cleanNum];
  if (!user) return { removed: false, reason: 'Not found' };
  try { await unlinkUserBot(user.sessionId); } catch (e) {}
  delete USERS[cleanNum];
  try { saveUsersToFile(); } catch (e) {}
  if (mongo && typeof mongo.isConnected === 'function' && mongo.isConnected() && typeof mongo.deleteUser === 'function') {
    try { await mongo.deleteUser(cleanNum); } catch (e) {}
  }
  return { removed: true, phone: cleanNum };
}

async function restoreAllSessions(ownerConn) {
  console.log('🔄 Restoring sessions...');
  let restored = 0, failed = 0;

  for (const user of Object.values(USERS)) {
    if (!user || !user.sessionId || !user.phone) continue;
    if (BOT_INSTANCES.has(user.sessionId)) continue;

    const sessionDir = path.join(USER_SESSIONS_DIR, user.sessionId);
    const credsPath = path.join(sessionDir, 'creds.json');

    if (!fs.existsSync(credsPath)) {
      try { const n = await authSync.restore(user.sessionId, sessionDir); if (n) console.log(`📥 Full session from Mongo: ${user.phone} (${n} files)`); } catch (e) {}
    }

    if (!fs.existsSync(credsPath)) {
      try {
        if (mongo && typeof mongo.isConnected === 'function' && mongo.isConnected() && typeof mongo.getSession === 'function') {
          const credsData = await mongo.getSession(user.sessionId);
          if (credsData) {
            if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
            fs.writeFileSync(credsPath, credsData, 'utf8');
            console.log(`📥 From Mongo: ${user.phone}`);
          }
        }
      } catch (e) {}
    }

    if (!fs.existsSync(credsPath)) { console.log(`⏭️ No session: ${user.phone}`); continue; }
    if (!authSync.isRegistered(sessionDir)) {
      // leftover of an unfinished pairing — useless (would only 401). Drop it so the number can start fresh.
      console.log(`🧹 Unfinished session of ${user.phone} removed`);
      try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
      try { await authSync.remove(user.sessionId); if (mongo && mongo.isConnected()) await mongo.deleteSession(user.sessionId); } catch (e) {}
      continue;
    }

    try {
      await createUserBot(user.sessionId, user.phone, ownerConn, { usePairingCode: false });
      restored++;
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`❌ ${user.phone}:`, e.message);
      failed++;
    }
  }
  console.log(`✅ Restore done — ${restored} ok, ${failed} failed`);
}

// ══════════════════════════════════════════════════════════════
// 🧹 AUTO-DELETE sessions that were never linked
// ══════════════════════════════════════════════════════════════
async function cleanupUnlinked() {
  const now = Date.now();

  // 1) bots that asked for a pairing code / QR but are still not linked after PAIR_TIMEOUT
  for (const [sid, inst] of [...BOT_INSTANCES.entries()]) {
    if (inst.status === 'active' || inst.connectedAt) continue;
    if (now - new Date(inst.startedAt).getTime() < PAIR_TIMEOUT_MS) continue;
    if (authSync.isRegistered(path.join(USER_SESSIONS_DIR, sid))) continue;   // real session (just reconnecting) -> keep
    const user = USERS[inst.phone];
    console.log(`🧹 ${inst.phone} did not link within ${PAIR_TIMEOUT_MS / 60000} min — deleting its session`);
    try { await unlinkUserBot(sid); } catch (e) {}
    if (user && !user.connectedAt) { try { await removeUser(inst.phone); } catch (e) {} }
  }

  // 2) leftover records / session folders of numbers that never linked (e.g. after a restart)
  for (const user of Object.values(USERS)) {
    if (!user || !user.sessionId || user.connectedAt || user.status === 'active') continue;
    if (BOT_INSTANCES.has(user.sessionId)) continue;
    const dir = path.join(USER_SESSIONS_DIR, user.sessionId);
    if (authSync.isRegistered(dir)) continue;
    const created = new Date(user.deployedAt || user.createdAt || 0).getTime();
    if (!created || now - created < PENDING_USER_TTL_MS) continue;
    console.log(`🧹 Removing never-linked user ${user.phone}`);
    try { await removeUser(user.phone); } catch (e) {}
  }
}

const _cleanupTimer = setInterval(() => cleanupUnlinked().catch(() => {}), 2 * 60 * 1000);
if (_cleanupTimer.unref) _cleanupTimer.unref();

module.exports = {
  LAST_ERRORS,
  cleanupUnlinked,
  USERS, BOT_INSTANCES,
  cleanPhone, generateSessionId, generateToken, generateOTP,
  generateDashPassword, generateUnique5Digit,
  getUserSessionDir, getUserConfigPath, loadUserConfig, saveUserConfig,
  loadUsers, persistUser, saveUsersToFile, sendOTP,
  createUserBot, stopUserBot, unlinkUserBot, removeUser,
  reconnectUserBot, restoreAllSessions
};
