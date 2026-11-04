// plugins/sendchannel.js
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
// ─────────────────────────────────────────

// ── Normalize channel JID ────────────────
function toChannelJid(input = '') {
    const s = String(input).trim();

    // Already a JID
    if (s.includes('@newsletter')) return s;

    // Channel link → extract invite code
    const linkMatch = s.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)/);
    if (linkMatch) return `${linkMatch[1]}@newsletter`;

    // Raw digits/letters → append suffix
    const digits = s.replace(/[^0-9]/g, '');
    return digits ? `${digits}@newsletter` : null;
}

cmd({
    pattern: "sendchannel",
    alias: ["sch", "sendtochannel"],
    use: '.sendchannel <channel_jid | channel_link> <message>',
    desc: "Send a message to a WhatsApp channel (owner only)",
    category: "owner",
    react: "📢",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isCreator, isOwner }) => {

    // ── Owner only ──────────────────────────
    if (!isCreator && !isOwner) {
        await conn.sendMessage(from, { react: { text: '⛔', key: mek.key } }).catch(() => {});
        return reply('❌ *Only the bot owner can use this command.*');
    }

    // ── Parse: first token = channel, rest = message ──
    const parts = (q || '').trim().split(/\s+/);
    const channelInput = parts[0];
    const message      = parts.slice(1).join(' ').trim();

    if (!channelInput || !message) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `❗ *Usage:*\n` +
            `.sendchannel <channel_jid | channel_link> <message>\n\n` +
            `*Examples:*\n` +
            `.sendchannel 123456789@newsletter Hello Channel!\n` +
            `.sendchannel 123456789 Hello Channel!\n` +
            `.sendchannel https://whatsapp.com/channel/0029VaXXXXX Hello Channel!`
        );
    }

    // ── Resolve JID ────────────────────────
    let finalJid = toChannelJid(channelInput);

    // If channelInput is a link, resolve via metadata
    if (channelInput.includes('whatsapp.com/channel/')) {
        const invite = channelInput.match(/channel\/([a-zA-Z0-9]+)/)?.[1];
        if (invite) {
            try {
                const meta = await conn.newsletterMetadata('invite', invite);
                if (meta?.id) finalJid = meta.id;
            } catch (e) {
                console.error('[sendchannel] metadata:', e.message);
            }
        }
    }

    if (!finalJid) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Invalid channel JID.*\n\nUse `.jid <link>` to get the correct JID first.');
    }

    // ── Send ────────────────────────────────
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        await conn.sendMessage(finalJid, { text: message });

        await reply(
            `✅ *Message sent to channel*\n\n` +
            `📌 *JID:* ${finalJid}\n` +
            `📝 *Message:* ${message.length > 100 ? message.slice(0, 100) + '...' : message}\n\n` +
            `⚡ Powered by ${BOT_NAME}`
        );

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (error) {
        console.error('[sendchannel]', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(
            `❌ *Error sending message:*\n_${error.message}_\n\n` +
            `💡 *Verify the channel JID:* ${finalJid}`
        );
    }
});