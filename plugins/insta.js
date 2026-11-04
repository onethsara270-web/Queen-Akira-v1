// plugins/insta.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME    = "Queen Zara";
const API_TIMEOUT = 20000;
// ─────────────────────────────────────────

function pickUrl(s = '') {
    const m = String(s).match(/https?:\/\/\S+/i);
    return m ? m[0] : '';
}

// ── Normalize API responses ───────────────
function extractMedia(data) {
    const r = data?.result || data?.data || data;
    const list = Array.isArray(r) ? r : (r?.medias || r?.items || []);
    const out = [];

    for (const item of list) {
        if (!item) continue;
        const url  = item.url || item.downloadUrl || item.src;
        const type = (item.type || '').toLowerCase()
            || (url && /\.(mp4|webm|mov)(\?|$)/i.test(url) ? 'video' : 'image');
        if (url && typeof url === 'string') {
            out.push({ url, type: type === 'video' ? 'video' : 'image' });
        }
    }
    return out;
}

// ── APIs in order ─────────────────────────
function buildApis(url) {
    const enc = encodeURIComponent(url);
    return [
        `https://api.vreden.my.id/api/igdownload?url=${enc}`,
        `https://api.siputzx.my.id/api/d/igdl?url=${enc}`,
        `https://api.alyachan.xyz/api/igdl?url=${enc}`
    ];
}

cmd({
    pattern: "insta",
    alias: ["ig", "igdl", "instagram"],
    use: '.insta <instagram url>',
    desc: "Download Instagram post/reel media",
    category: "download",
    react: "📸",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const url = pickUrl(q || '');
    if (!url) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `❌ *Please provide an Instagram URL.*\n\n` +
            `📌 *Example:*\n` +
            `.insta https://www.instagram.com/reel/XXXXX`
        );
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        let media = [];
        let lastErr = '';

        for (const api of buildApis(url)) {
            try {
                const { data } = await axios.get(api, {
                    timeout: API_TIMEOUT,
                    headers: { Accept: 'application/json' },
                    validateStatus: s => s < 500
                });
                media = extractMedia(data);
                if (media.length) break;
            } catch (e) {
                lastErr = e.message;
                console.error(`[insta] ${api.split('?')[0]} →`, e.message);
            }
        }

        if (!media.length) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply(
                `❌ *No media found.*\n\n` +
                `Make sure the link is public.\n` +
                (lastErr ? `_${lastErr}_` : '')
            );
        }

        // ── Send every item ─────────────────
        for (let i = 0; i < media.length; i++) {
            const item = media[i];
            const caption = `✅ *Instagram ${item.type === 'video' ? 'Video' : 'Image'}*` +
                (media.length > 1 ? ` (${i + 1}/${media.length})` : '') +
                `\n\n⚡ Powered by ${BOT_NAME}`;

            try {
                if (item.type === 'video') {
                    await conn.sendMessage(from, { video: { url: item.url }, caption }, { quoted: mek });
                } else {
                    await conn.sendMessage(from, { image: { url: item.url }, caption }, { quoted: mek });
                }
            } catch (sendErr) {
                console.error(`[insta] send item ${i + 1}:`, sendErr.message);
            }
        }

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[insta]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Error downloading Instagram content.* Make sure the link is public.');
    }
});