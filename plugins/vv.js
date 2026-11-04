// plugins/vv.js
const { downloadContentFromMessage } = require('fixo-baileys');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
// ─────────────────────────────────────────

// ── Media type mapping ────────────────────
const MEDIA_TYPES = {
    imageMessage: { type: 'image', key: 'image' },
    videoMessage: { type: 'video', key: 'video' },
    audioMessage: { type: 'audio', key: 'audio' }
};

cmd({
    pattern: "vv",
    alias: ["viewonce", "revo", "reveal"],
    use: '.vv (reply to a view-once message)',
    desc: "Reveal a view-once message",
    category: "tools",
    react: "👁️",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {

    // ── Quoted view-once ─────────────────────
    const ctx    = m.message?.extendedTextMessage?.contextInfo || {};
    const quoted = ctx.quotedMessage;

    if (!quoted) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Reply to a View-Once message.*');
    }

    const viewOnce = quoted.viewOnceMessageV2 || quoted.viewOnceMessage || quoted.viewOnceMessageV2Extension;
    const inner    = viewOnce?.message || quoted;
    const vType    = Object.keys(inner)[0];

    if (!MEDIA_TYPES[vType]) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Not a View-Once media message.*');
    }

    const { type, key } = MEDIA_TYPES[vType];

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── Download ─────────────────────────
        const stream = await downloadContentFromMessage(inner[vType], type);

        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        if (!buffer.length) throw new Error('empty buffer');

        // ── Send ─────────────────────────────
        const base = {
            caption: `✅ *View-Once ${type.charAt(0).toUpperCase() + type.slice(1)} Revealed*\n\n⚡ Powered by ${BOT_NAME}`
        };

        if (type === 'audio') {
            await conn.sendMessage(from, {
                audio: buffer,
                mimetype: 'audio/mp4',
                ptt: false
            }, { quoted: mek });
        } else {
            await conn.sendMessage(from, {
                [key]: buffer,
                ...base
            }, { quoted: mek });
        }

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[vv]', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Failed to download View-Once media.*\n_${e.message}_`);
    }
});
