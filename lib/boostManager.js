// ============================================================
// 🚀 BOOST MANAGER — Multi-session channel boost
// Path: lib/boostManager.js
// ============================================================
const userMgr = require('../user-manager');
const channelsLib = require('./channels');
const boostStore = require('./boostStore');
const config = require('../config');

const MIN_DELAY = parseInt(config.BOOST_MIN_DELAY_MS || '15000', 10);
const MAX_DELAY = parseInt(config.BOOST_MAX_DELAY_MS || '25000', 10);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randDelay = () => MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY));

function parseChannelLink(link) {
  const m = String(link || '').match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]{10,})(?:\/(\d+))?/i);
  if (!m) return null;
  return { channelCode: m[1], postId: m[2] || null };
}

function getConn(sessionId) {
  if (sessionId === '__owner__') {
    const c = global.ownerConn;
    return (c && c.user) ? c : null;
  }
  const inst = userMgr.BOT_INSTANCES.get(sessionId);
  return (inst && inst.status === 'active' && inst.conn) ? inst.conn : null;
}

function listConnectedSessions() {
  const list = [];
  if (global.ownerConn && global.ownerConn.user) {
    list.push({ sessionId: '__owner__', phone: String(global.ownerConn.user.id).split(':')[0], conn: global.ownerConn });
  }
  for (const [sessionId, inst] of userMgr.BOT_INSTANCES.entries()) {
    // ✅ මේකයි කලින් හරියට වැඩ කරපු කොටස
    if (inst.status === 'active' && inst.conn) {
      list.push({ sessionId, phone: inst.phone, conn: inst.conn });
    }
  }
  return list;
}

function resolveRequester(sessionId) {
  if (sessionId === '__owner__') {
    if (!global.ownerConn || !global.ownerConn.user) throw new Error('Your bot is not connected. Please connect first.');
    return { sessionId, phone: String(global.ownerConn.user.id).split(':')[0] };
  }
  const inst = userMgr.BOT_INSTANCES.get(sessionId);
  if (!inst || inst.status !== 'active' || !inst.conn) throw new Error('Your bot is not connected. Please connect first.');
  return { sessionId, phone: inst.phone };
}

// ── REACT BOOST ──
async function reactBoost({ requesterSessionId, channelLink, postId, emoji }) {
  const requester = resolveRequester(requesterSessionId);
  const parsed = parseChannelLink(channelLink);
  if (!parsed) throw new Error('Invalid channel link');
  
  const pid = postId || parsed.postId;
  if (!pid) throw new Error('Post ID missing. Please paste the full post URL');
  if (!emoji) throw new Error('Emoji is required');

  const sessions = listConnectedSessions();
  if (!sessions.length) throw new Error('No connected bots available');

  const info = await channelsLib.resolveChannelJid(sessions[0].conn, channelLink);
  if (!info) throw new Error('Channel not found — check the link');

  const participants = [];
  const errors = [];
  for (const s of sessions) {
    try {
      if (typeof s.conn.newsletterReactMessage !== 'function') throw new Error('newsletterReactMessage not supported');
      await s.conn.newsletterReactMessage(info.jid, pid, emoji);
      participants.push({ sessionId: s.sessionId, phone: s.phone, status: 'done', at: new Date() });
    } catch (e) {
      participants.push({ sessionId: s.sessionId, phone: s.phone, status: 'failed', error: e.message, at: new Date() });
      errors.push(`${s.phone}: ${e.message}`);
    }
    await sleep(randDelay());
  }

  const boost = await boostStore.create({
    requesterSessionId: requester.sessionId, requesterPhone: requester.phone,
    channelJid: info.jid, channelLink, channelName: info.name,
    actionType: 'react', postId: pid, emoji, participants
  });

  return {
    boostId: boost._id.toString(), channelJid: info.jid, channelName: info.name,
    total: participants.length,
    successful: participants.filter(p => p.status === 'done').length,
    failed: participants.filter(p => p.status === 'failed').length,
    errors
  };
}

// ── POLL BOOST (Text based) ──
async function pollBoost({ requesterSessionId, channelLink, postId, pollOption }) {
  const requester = resolveRequester(requesterSessionId);
  const parsed = parseChannelLink(channelLink);
  if (!parsed) throw new Error('Invalid channel link');
  
  const pid = postId || parsed.postId;
  if (!pid) throw new Error('Post ID missing. Paste the full poll post URL');
  if (!pollOption) throw new Error('Poll option text is required');

  const sessions = listConnectedSessions();
  if (!sessions.length) throw new Error('No connected bots available');

  const info = await channelsLib.resolveChannelJid(sessions[0].conn, channelLink);
  if (!info) throw new Error('Channel not found');

  const actualOptionText = String(pollOption).trim();
  console.log(`📊 [POLL BOOST] Voting for Option: "${actualOptionText}"`);

  const participants = [];
  const errors = [];
  
  for (const s of sessions) {
    try {
      if (typeof s.conn.newsletterSendPollVote === 'function') {
        await s.conn.newsletterSendPollVote(info.jid, pid, [actualOptionText]);
      } else if (typeof s.conn.newsletterVotePoll === 'function') {
        await s.conn.newsletterVotePoll(info.jid, pid, [actualOptionText]);
      } else {
        throw new Error('Poll voting not supported by this bot version');
      }
      participants.push({ sessionId: s.sessionId, phone: s.phone, status: 'done', at: new Date() });
    } catch (e) {
      participants.push({ sessionId: s.sessionId, phone: s.phone, status: 'failed', error: e.message, at: new Date() });
      errors.push(`${s.phone}: ${e.message}`);
    }
    await sleep(randDelay());
  }

  const boost = await boostStore.create({
    requesterSessionId: requester.sessionId, requesterPhone: requester.phone,
    channelJid: info.jid, channelLink, channelName: info.name,
    actionType: 'poll', postId: pid, pollOption: actualOptionText, participants
  });

  return {
    boostId: boost._id.toString(), channelJid: info.jid, channelName: info.name,
    total: participants.length,
    successful: participants.filter(p => p.status === 'done').length,
    failed: participants.filter(p => p.status === 'failed').length,
    errors
  };
}

// ── FOLLOW BOOST ──
async function followBoost({ requesterSessionId, channelLink }) {
  const requester = resolveRequester(requesterSessionId);
  const parsed = parseChannelLink(channelLink);
  if (!parsed) throw new Error('Invalid channel link');

  const sessions = listConnectedSessions();
  if (!sessions.length) throw new Error('No connected bots available');

  const info = await channelsLib.resolveChannelJid(sessions[0].conn, channelLink);
  if (!info) throw new Error('Channel not found');

  const participants = [];
  const errors = [];
  for (const s of sessions) {
    try {
      if (typeof s.conn.newsletterFollow !== 'function') throw new Error('newsletterFollow not supported');
      await s.conn.newsletterFollow(info.jid);
      participants.push({ sessionId: s.sessionId, phone: s.phone, status: 'done', at: new Date() });
    } catch (e) {
      participants.push({ sessionId: s.sessionId, phone: s.phone, status: 'failed', error: e.message, at: new Date() });
      errors.push(`${s.phone}: ${e.message}`);
    }
    await sleep(randDelay());
  }

  const boost = await boostStore.create({
    requesterSessionId: requester.sessionId, requesterPhone: requester.phone,
    channelJid: info.jid, channelLink, channelName: info.name,
    actionType: 'follow', participants
  });

  return {
    boostId: boost._id.toString(), channelJid: info.jid, channelName: info.name,
    total: participants.length,
    successful: participants.filter(p => p.status === 'done').length,
    failed: participants.filter(p => p.status === 'failed').length,
    errors
  };
}

// ── REVERT BOOST ──
async function revertBoost(boostId) {
  const boost = await boostStore.getById(boostId);
  if (!boost) throw new Error('Boost not found');
  if (boost.status === 'reverted') return { alreadyReverted: true };

  if (boost.actionType !== 'follow') {
    await boostStore.updateStatus(boostId, 'reverted');
    return { reverted: true, note: `${boost.actionType} can't be undone on WhatsApp; marked reverted` };
  }

  const results = [];
  for (const p of boost.participants) {
    if (p.status !== 'done') continue;
    const conn = getConn(p.sessionId);
    if (!conn) { results.push({ sessionId: p.sessionId, ok: false, error: 'not connected' }); continue; }
    try {
      if (typeof conn.newsletterUnfollow === 'function') await conn.newsletterUnfollow(boost.channelJid);
      results.push({ sessionId: p.sessionId, ok: true });
    } catch (e) { results.push({ sessionId: p.sessionId, ok: false, error: e.message }); }
    await sleep(randDelay());
  }
  await boostStore.updateStatus(boostId, 'reverted');
  return { reverted: true, results };
}

// ── AUTO-REVERT when requester disconnects ──
async function revertAllForRequester(requesterSessionId) {
  try {
    if (!require('./mongo').isConnected()) return { skipped: 'mongo off' };
    const boosts = await boostStore.getActiveByRequester(requesterSessionId);
    const results = [];
    for (const b of boosts) {
      try {
        const r = await revertBoost(b._id.toString());
        results.push({ boostId: b._id.toString(), actionType: b.actionType, ...r });
      } catch (e) { results.push({ boostId: b._id.toString(), error: e.message }); }
    }
    return { count: results.length, results };
  } catch (e) { return { error: e.message }; }
}

// ── Before session disconnects: unfollow its boost follows ──
async function unfollowAllBeforeDisconnect(conn, sessionId) {
  try {
    if (!conn || !require('./mongo').isConnected()) return { skipped: true };
    const boosts = await boostStore.getActiveByParticipant(sessionId);
    const followBoosts = boosts.filter(b => b.actionType === 'follow');
    const results = [];
    for (const b of followBoosts) {
      try {
        if (typeof conn.newsletterUnfollow === 'function') {
          await conn.newsletterUnfollow(b.channelJid);
          results.push({ channelJid: b.channelJid, ok: true });
        }
      } catch (e) { results.push({ channelJid: b.channelJid, ok: false, error: e.message }); }
      await sleep(randDelay());
    }
    return { count: results.length, results };
  } catch (e) { return { error: e.message }; }
}

// ── Periodic cleanup: revert if requester offline > 24h ──
async function cleanupInactiveRequesters() {
  try {
    if (!require('./mongo').isConnected()) return;
    const boosts = await boostStore.getAllActive();
    const now = Date.now();
    const GRACE = 24 * 60 * 60 * 1000;
    for (const b of boosts) {
      const active = b.requesterSessionId === '__owner__'
        ? !!(global.ownerConn && global.ownerConn.user)
        : (userMgr.BOT_INSTANCES.get(b.requesterSessionId)?.status === 'active');
      if (active) { await boostStore.touch(b._id.toString()); continue; }
      const last = new Date(b.lastActiveAt || b.createdAt).getTime();
      if (now - last < GRACE) continue;
      console.log(`🧹 Auto-revert boost ${b._id} (requester offline > 24h)`);
      await revertBoost(b._id.toString());
    }
  } catch (e) { console.error('boost cleanup:', e.message); }
}

module.exports = {
  reactBoost, pollBoost, followBoost, revertBoost,
  revertAllForRequester, unfollowAllBeforeDisconnect,
  cleanupInactiveRequesters
};
