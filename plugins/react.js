// plugins/react.js
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
const REACTIONS = [
    '❤️','👍','🔥','👏','😮','😂','🙌','✨','⭐','✅',
    '🤖','⚡','🌟','💯','🌈','💎','👑','🎉','🧿','🍀',
    '💖','💝','🎊','🎈','🌸','🌺','🌻','🌹','💐','🏆',
    '🥇','🎯','💪','🙏','👌','✌️','🤝','💫','🌠','🎁'
];
// ─────────────────────────────────────────

// ── Parse channel link ────────────────────
function parseChannelLink(url = '') {
    const m = url.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)(?:\/(\d+))?/);
    if (!m) return null;
    return { inviteCode: m[1], serverId: m[2] || null };
}

cmd({
    pattern: "react",
    alias: ["chreact", "channelreact"],
    use: '.react <channel post link>',
    desc: "Add a random reaction to a WhatsApp channel post",
    category: "tools",
    react: "🎯",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isCreator, isOwner }) => {

    // ── Owner only ──────────────────────────
    if (!isCreator && !isOwner) {
        await conn.sendMessage(from, { react: { text: '⛔', key: mek.key } }).catch(() => {});
        return reply('❌ *Owner only!*');
    }

    // ── Validate link ───────────────────────
    const link = (q || '').trim().split(/\s+/)[0];
    const parsed = parseChannelLink(link);

    if (!parsed) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `🎯 *Channel Post React*\n\n` +
            `📌 *Usage:* .react [channel_post_link]\n\n` +
            `📝 *Example:*\n` +
            `.react https://whatsapp.com/channel/xxx/123`
        );
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── Channel metadata ────────────────
        let meta;
        try {
            meta = await conn.newsletterMetadata('invite', parsed.inviteCode);
        } catch (e) {
            console.error('[react] metadata:', e.message);
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *Could not fetch channel info.* Check the link.');
        }

        if (!meta?.id) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *Channel not found.*');
        }

        const channelJid = meta.id;

        // ── Follow (if not already) ─────────
        try { await conn.newsletterFollow(channelJid); }
        catch { /* already followed */ }

        // ── Fetch recent messages ───────────
        let messages = [];
        try {
            const res = await conn.newsletterFetchMessages(channelJid, 50);
            messages = res?.messages || [];
        } catch (e) {
            console.error('[react] fetch:', e.message);
        }

        if (!messages.length) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *Could not fetch channel messages.* Try again later.');
        }

        // ── Locate target message ───────────
        // WhatsApp channel server IDs don't map 1:1 to `key.id`, so:
        //   1) try exact `key.id` match
        //   2) try server_id field
        //   3) fall back to latest message
        let target = null;

        if (parsed.serverId) {
            target =
                messages.find(x => x.key?.id === parsed.serverId) ||
                messages.find(x => String(x.server_id) === parsed.serverId) ||
                null;
        }

        if (!target) target = messages[0];

        if (!target) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *Could not find the post.*');
        }

        // ── React ──────────────────────────
        const emoji = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];

        try {
            await conn.sendMessage(channelJid, {
                react: { text: emoji, key: target.key }
            });
        } catch (e) {
            console.error('[react] send:', e.message);
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply(`❌ *Could not add reaction:*\n_${e.message}_`);
        }

        // ── Report ─────────────────────────
        const matchedExact = parsed.serverId &&
            (target.key?.id === parsed.serverId || String(target.server_id) === parsed.serverId);

        await reply(
            `✅ *REACTION ADDED*\n\n` +
            `📢 *Channel:* ${meta.name || 'Unknown'}\n` +
            `🎲 *Emoji:* ${emoji}\n` +
            `📌 *Post:* ${matchedExact ? 'exact match' : 'latest post'}\n\n` +
            `⚡ Powered by ${BOT_NAME}`
        );

        await conn.sendMessage(from, { react: { text: emoji, key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[react]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* ${e.message}`);
    }
});