// ============================================================
// 📢 CHANNEL (NEWSLETTER) HELPERS — multi channel support
// Path: lib/channels.js
// ============================================================
// Channel links live in config:
//   CHANNEL_LINK   -> main channel
//   CHANNEL_LINKS  -> extra channels, comma / space / newline separated
// Everything here only reads those two keys, so the dashboard,
// config.json, env vars and the .addchannel command all work together.
// ============================================================

const CHANNEL_RE = /whatsapp\.com\/channel\/([A-Za-z0-9_-]{10,})/i;

function extractInviteCode(link) {
  if (!link) return null;
  const m = String(link).match(CHANNEL_RE);
  return m ? m[1] : null;
}

function normalizeLink(link) {
  const code = extractInviteCode(link);
  return code ? `https://whatsapp.com/channel/${code}` : null;
}

function splitList(v) {
  return String(v || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
}

/** All unique channel links from a config object (main first, then extras). */
function getChannelLinks(cfg = {}) {
  const out = [];
  const seen = new Set();
  const push = (l) => {
    const n = normalizeLink(l);
    if (n && !seen.has(n)) { seen.add(n); out.push(n); }
  };
  push(cfg.CHANNEL_LINK);
  splitList(cfg.CHANNEL_LINKS).forEach(push);
  return out;
}

/** Config patch that stores the given list (first = main, rest = extras). */
function toConfigPatch(links) {
  return {
    CHANNEL_LINK: links[0] || '',
    CHANNEL_LINKS: links.slice(1).join(',')
  };
}

/** Resolve a channel invite link to its newsletter JID (needs a live connection). */
async function resolveChannelJid(conn, link) {
  const code = extractInviteCode(link);
  if (!code) return null;
  if (typeof conn.newsletterMetadata !== 'function') return null;
  const meta = await conn.newsletterMetadata('invite', code);
  return meta && meta.id ? { jid: meta.id, name: meta.name || meta.thread_metadata?.name?.text || '' } : null;
}

async function followChannel(conn, link) {
  const info = await resolveChannelJid(conn, link);
  if (!info) throw new Error('channel not found');
  if (typeof conn.newsletterFollow !== 'function') throw new Error('newsletterFollow not supported');
  await conn.newsletterFollow(info.jid);
  return info;
}

/** Follow every configured channel (plus NEWSLETTER_JID when it is set). */
async function followAllChannels(conn, cfg = {}, log = console.log) {
  const links = getChannelLinks(cfg);
  const results = [];
  for (const link of links) {
    try {
      const info = await followChannel(conn, link);
      log(`✅ [CHANNEL] Following ${info.name || info.jid}`);
      results.push({ link, ok: true, ...info });
    } catch (e) {
      // already following / temporary WhatsApp error — not fatal
      log(`⚠️ [CHANNEL] ${link} -> ${e.message}`);
      results.push({ link, ok: false, error: e.message });
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  return results;
}

module.exports = {
  extractInviteCode, normalizeLink, getChannelLinks, toConfigPatch,
  resolveChannelJid, followChannel, followAllChannels
};
