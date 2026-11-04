// plugins/tiktok.js
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

function isTikTokUrl(url) {
    return /(?:tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)/i.test(url);
}

// ── Extract video URL from various API shapes ──
function extractVideo(data) {
    // tikwm.com
    if (data?.data?.play) {
        return {
            url:   data.data.play,
            hd:    data.data.hdplay || data.data.play,
            title: data.data.title || 'TikTok Video',
            author: data.data.author?.nickname || data.data.author?.unique_id || 'TikTok'
        };
    }
    // generic
    const r = data?.result || data?.data || data;
    if (r?.video || r?.play || r?.url) {
        return {
            url:    r.hdplay || r.hd || r.video || r.play || r.url,
            hd:     r.hd || r.hdplay,
            title:  r.title || r.desc || 'TikTok Video',
            author: r.author?.nickname || r.author || 'TikTok'
        };
    }
    return null;
}

cmd({
    pattern: "tiktok",
    alias: ["tt", "ttdl", "tikwm"],
    use: '.tiktok <tiktok url>',
    desc: "Download a TikTok video",
    category: "download",
    react: "📱",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const url = pickUrl(q || '');
    if (!url) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `❌ *Please provide a TikTok URL.*\n\n` +
            `📌 *Example:*\n` +
            `.tiktok https://www.tiktok.com/@user/video/123...`
        );
    }

    if (!isTikTokUrl(url)) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Not a TikTok link.*');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── APIs ─────────────────────────────
        const apis = [
            `https://tikwm.com/api/?url=${encodeURIComponent(url)}`,
            `https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`,
            `https://api.vreden.my.id/api/tiktok?url=${encodeURIComponent(url)}`
        ];

        let info = null;
        let lastErr = '';

        for (const api of apis) {
            try {
                const { data } = await axios.get(api, {
                    timeout: API_TIMEOUT,
                    headers: { Accept: 'application/json' },
                    validateStatus: s => s < 500
                });
                info = extractVideo(data);
                if (info?.url) break;
            } catch (e) {
                lastErr = e.message;
                console.error(`[tiktok] ${api.split('?')[0]} →`, e.message);
            }
        }

        if (!info?.url) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply(`❌ *Could not fetch TikTok video.*\n${lastErr ? `_${lastErr}_` : ''}`);
        }

        // ── Send ─────────────────────────────
        const caption =
            `✅ *TIKTOK VIDEO*\n\n` +
            `📌 *Title:* ${info.title}\n` +
            `👤 *Author:* ${info.author}\n\n` +
            `⚡ Powered by ${BOT_NAME}`;

        await conn.sendMessage(from, {
            video: { url: info.hd || info.url },
            caption
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[tiktok]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error downloading TikTok:*\n_${e.message}_`);
    }
});