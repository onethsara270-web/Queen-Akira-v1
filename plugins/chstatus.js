// plugins/chstatus.js
const { downloadContentFromMessage } = require('fixo-baileys');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const DEFAULT_BG = '#FFC107'; // WhatsApp text status default yellow
// ─────────────────────────────────────────

// Helper: Link/JID → Channel JID
async function resolveChannel(conn, input) {
    if (!input) return null;
    if (input.endsWith('@newsletter')) return input;

    const link = input.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)/);
    if (link) {
        try {
            const meta = await conn.newsletterMetadata('invite', link[1]);
            return meta?.id || null;
        } catch { return null; }
    }
    return null;
}

// Helper: Build content object
async function buildContent(m, text) {
    const ctx = m.message?.extendedTextMessage?.contextInfo || {};
    const quoted = ctx.quotedMessage;

    if (quoted) {
        const vType = Object.keys(quoted)[0];
        const mediaKey = vType?.replace('Message', '');

        if (['imageMessage', 'videoMessage', 'audioMessage'].includes(vType)) {
            try {
                const stream = await downloadContentFromMessage(quoted[vType], mediaKey);
                const chunks = [];
                for await (const c of stream) chunks.push(c);
                const buffer = Buffer.concat(chunks);
                if (!buffer.length) return null;

                if (vType === 'imageMessage') return { image: buffer, caption: text || '' };
                if (vType === 'videoMessage') return { video: buffer, caption: text || '' };
                if (vType === 'audioMessage') return { audio: buffer, mimetype: 'audio/mp4', ptt: false };
            } catch (e) {
                console.error('[chstatus] media error:', e.message);
            }
        }
    }

    if (text) {
        return {
            text: text,
            backgroundColor: DEFAULT_BG,
            font: 2
        };
    }
    return null;
}

cmd({
    pattern: "chstatus",
    alias: ["channelstatus", "cstatus"],
    use: '.chstatus <link/jid> <text> (or reply to media)',
    desc: "Post a WhatsApp Channel Status (experimental)",
    category: "channel",
    react: "📢",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isCreator, isOwner }) => {

    if (!isCreator && !isOwner) {
        await conn.sendMessage(from, { react: { text: '⛔', key: mek.key } }).catch(() => {});
        return reply('❌ *Owner only command.*');
    }

    if (!q) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `📢 *CHANNEL STATUS*\n\n` +
            `*Usage:*\n` +
            `.chstatus <channel_link/jid> <text>\n` +
            `.chstatus <channel_link/jid> (reply to image/video/audio)\n\n` +
            `*Example:*\n` +
            `.chstatus https://whatsapp.com/channel/0029VaXXXXX Hello!`
        );
    }

    const parts = q.trim().split(/\s+/);
    const target = parts[0];
    const text = parts.slice(1).join(' ');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const jid = await resolveChannel(conn, target);
        if (!jid) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *Invalid channel link or JID.*');
        }

        // Permission check
        const { canPost, role } = await conn.newsletterCanPostStatus(jid);
        if (!canPost) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply(`❌ *Bot is not an Admin/Owner in this channel.*\nRole: ${role}`);
        }

        const content = await buildContent(m, text);
        if (!content) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *Give text, or reply to an image/video/audio.*');
        }

        // Send status (mode: 'status' is default)
        const res = await conn.sendChannelStatus(jid, content, {
            mode: 'status',
            checkPermission: true,
            rawLog: true // logs payload to console for debugging
        });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
        await reply(
            `✅ *Channel Status posted!*\n\n` +
            `📌 *JID:* ${jid}\n` +
            `🆔 *Message ID:* ${res.key.id}\n` +
            `🌐 *Server ID:* ${res.serverId || 'N/A'}\n\n` +
            `⚠️ *Note:* If it still appears in the chat instead of the status ring, ` +
            `send the \`capture.log\` from the phone-side status to the developer to fix the stanza.`
        );

    } catch (e) {
        console.error('[chstatus]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});

        if (e.output?.statusCode === 403) {
            return reply('❌ *Permission denied.* Bot must be channel admin/owner.');
        }
        if (e.output?.statusCode === 429) {
            const retry = e.data?.retryAfter || 'a while';
            return reply(`⏳ *Rate limited by WhatsApp.* Try again after ${retry}s.`);
        }
        return reply(`❌ *Failed to post status:*\n_${e.message}_`);
    }
});
