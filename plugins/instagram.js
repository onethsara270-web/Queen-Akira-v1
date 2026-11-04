// plugins/insta.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME    = "Queen Zara";
const API_TIMEOUT = 20000;
const MAX_ITEMS   = 5;
// ─────────────────────────────────────────

// ruhend-scraper optional — fail වුණත් bot crash වෙන්නෙ නෑ
let igdl = null;
try { ({ igdl } = require('ruhend-scraper')); }
catch (e) { console.warn('[insta] ruhend-scraper not installed, will use axios fallback'); }

// ── Helpers ──────────────────────────────
function pickUrl(s = '') {
    const m = String(s).match(/https?:\/\/\S+/i);
    return m ? m[0] : '';
}

function isInstaUrl(url) {
    return /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\//i.test(url);
}

function isVideoUrl(url = '') {
    return /\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(url);
}

// ruhend shape → { url, type }[]
function fromRuhend(data) {
    if (!Array.isArray(data)) return [];
    return data
        .filter(m => m && m.url)
        .map(m => ({
            url: m.url,
            type: (m.type === 'video' || isVideoUrl(m.url)) ? 'video' : 'image'
        }));
}

// axios API shape → { url, type }[]
function fromAxios(data) {
    const r = data?.result || data?.data || data;
    const list = Array.isArray(r) ? r : (r?.medias || r?.items || []);
    return list
        .filter(m => m && (m.url || m.downloadUrl || m.src))
        .map(m => {
            const url = m.url || m.downloadUrl || m.src;
            return {
                url,
                type: (m.type === 'video' || isVideoUrl(url)) ? 'video' : 'image'
            };
        });
}

// ── Dedup ────────────────────────────────
function dedupe(items) {
    const seen = new Set();
    return items.filter(i => {
        if (seen.has(i.url)) return false;
        seen.add(i.url);
        return true;
    });
}

// ── Axios fallback APIs ──────────────────
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
            `❌ *Please provide an Instagram link.*\n\n` +
            `📌 *Example:*\n` +
            `.insta https://www.instagram.com/reel/XXXXX`
        );
    }

    if (!isInstaUrl(url)) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Invalid Instagram link.*');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        let media = [];

        // ── 1. ruhend-scraper ────────────────
        if (igdl) {
            try {
                const res = await igdl(url);
                media = fromRuhend(res?.data);
            } catch (e) {
                console.error('[insta] ruhend:', e.message);
            }
        }

        // ── 2. axios fallback ────────────────
        if (!media.length) {
            for (const api of buildApis(url)) {
                try {
                    const { data } = await axios.get(api, {
                        timeout: API_TIMEOUT,
                        headers: { Accept: 'application/json' },
                        validateStatus: s => s < 500
                    });
                    media = fromAxios(data);
                    if (media.length) break;
                } catch (e) {
                    console.error(`[insta] ${api.split('?')[0]} →`, e.message);
                }
            }
        }

        media = dedupe(media).slice(0, MAX_ITEMS);

        if (!media.length) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *No media found.* The post might be private or the link invalid.');
        }

        // ── Send every item ──────────────────
        let sent = 0;
        for (let i = 0; i < media.length; i++) {
            const item = media[i];
            const caption =
                `✅ *Instagram ${item.type === 'video' ? 'Video' : 'Image'}*` +
                (media.length > 1 ? ` (${i + 1}/${media.length})` : '') +
                `\n\n⚡ Powered by ${BOT_NAME}`;

            try {
                if (item.type === 'video') {
                    await conn.sendMessage(from, { video: { url: item.url }, caption }, { quoted: mek });
                } else {
                    await conn.sendMessage(from, { image: { url: item.url }, caption }, { quoted: mek });
                }
                sent++;
            } catch (e) {
                console.error(`[insta] send item ${i + 1}:`, e.message);
            }
        }

        await conn.sendMessage(from, { react: { text: sent ? '✅' : '❌', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[insta]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Error processing Instagram link.*');
    }
});