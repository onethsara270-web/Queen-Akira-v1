// plugins/jid.js
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
// ─────────────────────────────────────────

function onlyDigits(s = '') { return String(s).replace(/\D/g, ''); }

function getChannelJid(channelId) {
    return `${onlyDigits(channelId)}@newsletter`;
}

cmd({
    pattern: "jid",
    alias: ["getjid", "chjid"],
    use: '.jid <channel link | channel id | number>',
    desc: "Get JID from a channel link, channel ID, or phone number",
    category: "tools",
    react: "🆔",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    // ── Quoted fallback ─────────────────────
    const ctx = m.message?.extendedTextMessage?.contextInfo || {};
    const quoted =
        ctx.quotedMessage?.conversation ||
        ctx.quotedMessage?.extendedTextMessage?.text ||
        '';

    const input = ((q || '').trim() || quoted).trim();

    if (!input) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `❗ *Usage:*\n` +
            `.jid <Channel Link | Channel ID | Number>\n` +
            `Or reply to a channel link/ID with .jid\n\n` +
            `*Examples:*\n` +
            `.jid https://whatsapp.com/channel/0029VaXXXXX\n` +
            `.jid 0029VaXXXXX\n` +
            `.jid 94703945265`
        );
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── Extract channel ID ───────────────
        let channelId = input;
        if (input.includes('whatsapp.com/channel/')) {
            channelId = input.split('whatsapp.com/channel/')[1].split(/[/?#]/)[0];
        }

        const digits = onlyDigits(channelId);
        if (!digits) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *No valid ID found in the input.*');
        }

        // ── Build result lines ───────────────
        const lines = [
            `📢 *JID LOOKUP*`,
            ``,
            `📌 *Input:* ${channelId}`,
            `🆔 *Channel JID:* \`${getChannelJid(digits)}\``
        ];

        // Phone-number style input → extra user JID line
        if (digits.length <= 15 && !input.includes('whatsapp.com/channel/')) {
            lines.push(`👤 *User JID:* \`${digits}@s.whatsapp.net\``);
        }

        lines.push(``);
        lines.push(`⚡ Powered by ${BOT_NAME}`);

        await reply(lines.join('\n'));
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (error) {
        console.error('[jid]', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Failed to extract JID!*');
    }
});