// plugins/tagall.js
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME  = "Queen Zara";
const MAX_SHOW  = 100;   // WhatsApp message length safety
// ─────────────────────────────────────────

cmd({
    pattern: "tagall",
    alias: ["everyone", "all"],
    use: '.tagall <message>',
    desc: "Tag every group member by name",
    category: "group",
    react: "📢",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isGroup, isAdmin, isCreator, isOwner }) => {

    // ── Group only ──────────────────────────
    if (!isGroup) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *This command can only be used in groups.*');
    }

    // ── Admin / owner only ──────────────────
    if (!isAdmin && !isCreator && !isOwner) {
        await conn.sendMessage(from, { react: { text: '⛔', key: mek.key } }).catch(() => {});
        return reply('❌ *Only admins can use this command.*');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const meta = await conn.groupMetadata(from);
        const participants = meta.participants || [];

        if (!participants.length) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *No participants found.*');
        }

        const message = (q || '').trim() || '👋 Attention everyone!';

        // ── Build body ──────────────────────
        const shown = participants.slice(0, MAX_SHOW);
        const lines = shown.map(p => `🔹 @${p.id.split('@')[0]}`);

        if (participants.length > MAX_SHOW) {
            lines.push(`… +${participants.length - MAX_SHOW} more`);
        }

        const text =
            `📢 *TAG ALL*\n\n` +
            `📝 *Message:* ${message}\n\n` +
            `${lines.join('\n')}\n\n` +
            `⚡ Powered by ${BOT_NAME}`;

        await conn.sendMessage(from, {
            text,
            mentions: participants.map(p => p.id)
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (err) {
        console.error('[tagall]', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* ${err.message || String(err)}`);
    }
});