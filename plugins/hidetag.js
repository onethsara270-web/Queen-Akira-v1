// plugins/hidetag.js
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
// ─────────────────────────────────────────

cmd({
    pattern: "hidetag",
    alias: ["ht", "tagall"],
    use: '.hidetag <message>',
    desc: "Tag all group members without showing mention text",
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
        await conn.sendMessage(from, { react: { text: '📢', key: mek.key } }).catch(() => {});

        const meta = await conn.groupMetadata(from);
        const participants = (meta.participants || []).map(p => p.id);

        if (!participants.length) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *No participants found in this group.*');
        }

        const message = (q || '').trim() || '👋 Hi Everyone!';

        await conn.sendMessage(from, {
            text: message,
            mentions: participants
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (err) {
        console.error('[hidetag]', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* ${err.message || String(err)}`);
    }
});