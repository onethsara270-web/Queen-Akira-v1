// ============================================================
// 🧭 AUTOMATION DASHBOARD API
// Path: routes/automation.js
//
// Backs the single-page dashboard at public/index.html (served at
// GET /panel). Every endpoint here acts on ONE session that the
// caller already owns/connected through this same server — there is
// no "run this on every session" fan-out anywhere in this file, by
// design: this is a control panel for your own bots, not a tool for
// coordinating many accounts at one target.
//
// Mounted from index.js:  app.use('/api/automation', require('./routes/automation')({ botStatus }));
// ============================================================

const express = require('express');
const userMgr = require('../user-manager');
const channelsLib = require('../lib/channels');
const taskQueue = require('../lib/taskQueue');
const config = require('../config');

const SETTINGS_KEYS = [
  'AUTO_STATUS_SEEN',   // Status Seen (read receipts on statuses)
  'AUTO_STATUS_REACT',  // Status React
  'AUTO_STATUS_REPLY',  // Status Reply
  'AUTO_RECORDING',     // Auto Recording presence
  'AUTO_TYPING',        // Auto Typing presence
  'ALWAYS_ONLINE'       // Always Online presence
];

// ── Task handlers — each one runs against exactly one session's live connection ──
taskQueue.registerHandler('react', async ({ sessionId, chatJid, messageId, participant, fromMe, emoji }) => {
  const conn = connFor(sessionId);
  if (!chatJid || !messageId || !emoji) throw new Error('chatJid, messageId and emoji are required');
  const key = { remoteJid: chatJid, id: messageId, fromMe: !!fromMe };
  if (participant) key.participant = participant;
  await conn.sendMessage(chatJid, { react: { text: emoji, key } });
  return { reacted: true, chatJid, messageId, emoji };
});

taskQueue.registerHandler('poll', async ({ sessionId, chatJid, question, options, selectableCount }) => {
  const conn = connFor(sessionId);
  const opts = (options || []).map(o => String(o).trim()).filter(Boolean);
  if (!chatJid || !question || opts.length < 2) throw new Error('chatJid, question and at least 2 options are required');
  if (opts.length > 12) throw new Error('WhatsApp polls allow at most 12 options');
  const sent = await conn.sendMessage(chatJid, {
    poll: { name: question, values: opts, selectableCount: Math.max(1, Math.min(selectableCount || 1, opts.length)) }
  });
  return { sent: true, chatJid, messageId: sent?.key?.id || null };
});

taskQueue.registerHandler('follow', async ({ sessionId, channelLink }) => {
  const conn = connFor(sessionId);
  if (!channelLink || !channelsLib.extractInviteCode(channelLink)) throw new Error('A valid WhatsApp channel link is required');
  const info = await channelsLib.followChannel(conn, channelLink);
  if (!info) throw new Error('Could not resolve/follow that channel');
  return { followed: true, jid: info.jid, name: info.name || null };
});

// ── Helpers ─────────────────────────────────────────────────
function connFor(sessionId) {
  const conn = sessionId === '__owner__' ? global.ownerConn : userMgr.BOT_INSTANCES.get(sessionId)?.conn;
  if (!conn) throw new Error('That session is not connected right now.');
  return conn;
}

function isConnected(sessionId) {
  if (sessionId === '__owner__') return !!(global.ownerConn && global.ownerConn.user);
  const inst = userMgr.BOT_INSTANCES.get(sessionId);
  return !!(inst && inst.status === 'active' && inst.conn);
}

function sessionSummary(botStatus) {
  const list = [];

  // Owner session
  list.push({
    sessionId: '__owner__',
    label: config.OWNER_NAME || 'Owner',
    phone: botStatus.user ? String(botStatus.user).split(':')[0] : null,
    status: botStatus.connected ? 'active' : 'offline',
    isOwner: true,
    connectedAt: botStatus.lastUpdate || null
  });

  // Every user-deployed bot (/freebot and the dashboard's own "connect" button use the same registry)
  for (const user of Object.values(userMgr.USERS)) {
    const inst = userMgr.BOT_INSTANCES.get(user.sessionId);
    list.push({
      sessionId: user.sessionId,
      label: user.name || user.phone,
      phone: user.phone,
      status: inst?.status || user.status || 'offline',
      isOwner: false,
      connectedAt: inst?.connectedAt || user.connectedAt || null
    });
  }
  return list;
}

function readSettings(sessionId) {
  const cfg = sessionId === '__owner__'
    ? (global.ownerConn?._userConfig || {})
    : userMgr.loadUserConfig(sessionId);
  const out = {};
  for (const k of SETTINGS_KEYS) out[k] = String((cfg[k] !== undefined ? cfg[k] : config[k]) ?? 'false') === 'true';
  return out;
}

function writeSettings(sessionId, patch) {
  const clean = {};
  for (const k of SETTINGS_KEYS) {
    if (patch[k] !== undefined) clean[k] = String(!!patch[k]);
  }

  if (sessionId === '__owner__') {
    if (global.ownerConn) {
      if (!global.ownerConn._userConfig) global.ownerConn._userConfig = {};
      Object.assign(global.ownerConn._userConfig, clean);
    }
    return clean;
  }

  const current = userMgr.loadUserConfig(sessionId);
  Object.assign(current, clean);
  userMgr.saveUserConfig(sessionId, current);
  const inst = userMgr.BOT_INSTANCES.get(sessionId);
  if (inst && inst.conn) {
    if (!inst.conn._userConfig) inst.conn._userConfig = {};
    Object.assign(inst.conn._userConfig, clean);
  }
  return clean;
}

// ── Router ──────────────────────────────────────────────────
module.exports = function createAutomationRouter({ botStatus }) {
  const router = express.Router();

  // Sessions ---------------------------------------------------
  router.get('/sessions', (req, res) => {
    res.json({ success: true, sessions: sessionSummary(botStatus) });
  });

  // Start a new session (QR flow). Body: { label }
  router.post('/sessions', async (req, res) => {
    try {
      const label = (req.body && req.body.label ? String(req.body.label) : '').trim();
      const sessionId = userMgr.generateSessionId();
      const phone = label ? userMgr.cleanPhone(label) || label.replace(/\s+/g, '_') : sessionId;

      const user = {
        phone, name: label || 'Dashboard session',
        createdAt: new Date().toISOString(),
        sessionId,
        dashPassword: userMgr.generateUnique5Digit(),
        status: 'pending', token: null, deployedAt: new Date().toISOString()
      };
      await userMgr.persistUser(user);

      userMgr.LAST_ERRORS.delete(sessionId);
      userMgr.createUserBot(sessionId, phone, global.ownerConn, { usePairingCode: false })
        .catch(e => console.error('❌ Automation connect:', e.stack || e.message));

      res.json({ success: true, sessionId });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Poll QR / connection status while linking
  router.get('/sessions/:sessionId/status', (req, res) => {
    const { sessionId } = req.params;
    if (sessionId === '__owner__') {
      return res.json({ success: true, status: botStatus.connected ? 'active' : 'offline', qr: null, connectedAt: botStatus.lastUpdate || null });
    }
    const instance = userMgr.BOT_INSTANCES.get(sessionId);
    res.json({
      success: true,
      status: instance?.status || 'offline',
      qr: instance?.qr || null,
      pairingCode: instance?.pairingCode || null,
      pairingCodeError: instance?.pairingCodeError || null,
      debug: instance?.lastEvent || (instance ? null : (userMgr.LAST_ERRORS.get(sessionId) ? 'bot could not start: ' + userMgr.LAST_ERRORS.get(sessionId) : 'no bot instance on the server')),
      connectedAt: instance?.connectedAt || null
    });
  });

  router.delete('/sessions/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (sessionId === '__owner__') return res.status(400).json({ success: false, error: 'The owner session cannot be removed here.' });
      await userMgr.unlinkUserBot(sessionId);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Settings -----------------------------------------------------
  router.get('/sessions/:sessionId/settings', (req, res) => {
    try { res.json({ success: true, settings: readSettings(req.params.sessionId) }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  router.post('/sessions/:sessionId/settings', (req, res) => {
    try {
      const saved = writeSettings(req.params.sessionId, req.body || {});
      res.json({ success: true, settings: readSettings(req.params.sessionId), updated: saved });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Tasks ----------------------------------------------------------
  // Every task below runs against ONE connected session named in the
  // body (sessionId) — never "all sessions" / "every bot".
  router.post('/tasks/react', (req, res) => {
    try {
      const body = req.body || {};
      if (!isConnected(body.sessionId)) return res.status(400).json({ success: false, error: 'That session is not connected.' });
      const job = taskQueue.enqueue('react', body);
      res.json({ success: true, job });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  });

  router.post('/tasks/poll', (req, res) => {
    try {
      const body = req.body || {};
      if (!isConnected(body.sessionId)) return res.status(400).json({ success: false, error: 'That session is not connected.' });
      const job = taskQueue.enqueue('poll', body);
      res.json({ success: true, job });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  });

  router.post('/tasks/follow', (req, res) => {
    try {
      const body = req.body || {};
      if (!isConnected(body.sessionId)) return res.status(400).json({ success: false, error: 'That session is not connected.' });
      const job = taskQueue.enqueue('follow', body);
      res.json({ success: true, job });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  });

  router.get('/tasks', (req, res) => {
    res.json({ success: true, tasks: taskQueue.list({ sessionId: req.query.sessionId, limit: 50 }) });
  });

  router.get('/tasks/:id', (req, res) => {
    const job = taskQueue.get(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, job });
  });

  return router;
};
