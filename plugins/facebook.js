// plugins/fb.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME    = "Queen Zara";
const API_TIMEOUT = 20000;
// ─────────────────────────────────────────

// ── Extract first http(s) URL from string ──
function pickUrl(s = '') {
    const m = String(s).match(/https?:\/\/\S+/i);
    return m ? m[0] : '';
}

// ── APIs (tried in order) ─────────────────
function buildApis(url) {
    const enc = encodeURIComponent(url);
    return [
        `https://api.siputzx.my.id/api/d/fb?url=${enc}`,
        `https://api.nexoracle.com/downloader/facebook?url=${enc}`,
        `https://api.alyachan.xyz/api/fbdl?url=${enc}`
    ];
}

// ── Normalize whatever JSON shape comes back ──
function extractVideo(data) {
    const r = data?.data || data?.result || data;
    const list = Array.isArray(r) ? r : [r];

    for (const item of list) {
        if (!item) continue;
        const hd  = item.hd || item.HD || item.hdUrl;
        const sd  = item.sd || item.SD || item.sdUrl;
        const url = item.url || item.downloadUrl || item.video || item.videoUrl;

        const media = hd || sd || url;
        if (media && typeof media === 'string') {
            return {
                videoUrl: media,
                title:    item.title || item.desc || 'Facebook Video',
                desc:     item.description || item.snippet || ''
            };
        }
    }
    return null;
}

cmd({
    pattern: "fb",
    alias: ["fbdl", "facebook"],
    use: '.fb <facebook video url>',
    desc: "Download a Facebook video/reel",
    category: "download",
    react: "📥",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const fbUrl = pickUrl(q || '');
    if (!fbUrl) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `*𝐏ℓєαʂє 𝐏ɼ๏νιɖє 𝐀 fb҇ 𝐕ιɖє๏ ๏ɼ ɼєєℓ 𝐔ɼℓ..*\n\n` +
            `📌 *Example:*\n` +
            `.fb https://www.facebook.com/watch/?v=123456789`
        );
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        let picked = null;
        let lastErr = '';

        for (const api of buildApis(fbUrl)) {
            try {
                const { data } = await axios.get(api, {
                    timeout: API_TIMEOUT,
                    headers: { Accept: 'application/json' },
                    validateStatus: s => s < 500
                });
                picked = extractVideo(data);
                if (picked) break;
            } catch (e) {
                lastErr = e.message;
                console.error(`[fb] ${api.split('?')[0]} →`, e.message);
            }
        }

        if (!picked) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply(
                `❌ *Video could not be found.*\n\n` +
                `Check that the link is public and valid.\n` +
                (lastErr ? `_${lastErr}_` : '')
            );
        }

        const caption =
            `📥 *FACEBOOK DOWNLOAD* 📥\n\n` +
            `📌 *Title:* ${picked.title}\n` +
            `📝 *Desc:* ${picked.desc || 'N/A'}\n\n` +
            `⚡ Powered by ${BOT_NAME}`;

        await conn.sendMessage(from, {
            video: { url: picked.videoUrl },
            caption
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (error) {
        console.error('[fb]', error.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});

        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return reply('⏳ *Request Timeout:* server responded too slowly. Try again.');
        }
        return reply('❌ *Failed to fetch the video.* Try again in a moment.');
    }
});