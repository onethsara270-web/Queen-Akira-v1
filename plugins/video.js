// plugins/video.js
const axios = require('axios');
const yts = require('yt-search');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME    = "Queen Zara";
const API_TIMEOUT = 60000;
const DL_TIMEOUT  = 180000;   // video bigger than audio
const MAX_MB      = 100;      // WhatsApp video limit safety
// ─────────────────────────────────────────

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*'
};

// ── Retry ─────────────────────────────────
async function tryRequest(fn, attempts = 3) {
    let last;
    for (let i = 1; i <= attempts; i++) {
        try { return await fn(); }
        catch (e) {
            last = e;
            if (i < attempts) await new Promise(r => setTimeout(r, 1000 * i));
        }
    }
    throw last;
}

// ── API extractors ────────────────────────
async function eliteProTech(url) {
    const r = await tryRequest(() => axios.get(
        `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp4`,
        { timeout: API_TIMEOUT, headers: HEADERS }
    ));
    if (r?.data?.success && r?.data?.downloadURL) return { download: r.data.downloadURL, title: r.data.title };
    throw new Error('eliteProTech no download');
}

async function yupra(url) {
    const r = await tryRequest(() => axios.get(
        `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`,
        { timeout: API_TIMEOUT, headers: HEADERS }
    ));
    if (r?.data?.success && r?.data?.data?.download_url) {
        return { download: r.data.data.download_url, title: r.data.data.title };
    }
    throw new Error('yupra no download');
}

async function okatsu(url) {
    const r = await tryRequest(() => axios.get(
        `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`,
        { timeout: API_TIMEOUT, headers: HEADERS }
    ));
    if (r?.data?.result?.mp4) {
        return { download: r.data.result.mp4, title: r.data.result.title };
    }
    throw new Error('okatsu no download');
}

cmd({
    pattern: "video",
    alias: ["ytv", "ytmp4", "vid"],
    use: '.video <name | youtube url>',
    desc: "Download a YouTube video",
    category: "download",
    react: "🎥",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const query = (q || '').trim();
    if (!query) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply('🎥 *Usage:* .video <name or YouTube URL>');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── Resolve ─────────────────────────
        let videoUrl = '';
        let videoTitle = 'YouTube Video';
        let thumbnail = null;

        if (/youtube\.com|youtu\.be/i.test(query)) {
            videoUrl = query;
        } else {
            const { videos } = await yts(query);
            if (!videos?.length) {
                await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
                return reply('❌ *No videos found.*');
            }
            videoUrl      = videos[0].url;
            videoTitle    = videos[0].title;
            thumbnail     = videos[0].thumbnail;
        }

        // ── Preview ─────────────────────────
        try {
            if (thumbnail) {
                await conn.sendMessage(from, {
                    image: { url: thumbnail },
                    caption:
                        `🎥 *Downloading...*\n\n` +
                        `📌 *Title:* ${videoTitle}\n` +
                        (videos?.[0]?.timestamp ? `⏱ *Duration:* ${videos[0].timestamp}` : '')
                }, { quoted: mek });
            } else {
                await reply(`🎥 *Downloading...*\n\n📌 ${videoTitle}`);
            }
        } catch { /* non-critical */ }

        // ── Try APIs ────────────────────────
        const methods = [
            { name: 'eliteProTech', fn: () => eliteProTech(videoUrl) },
            { name: 'yupra',        fn: () => yupra(videoUrl) },
            { name: 'okatsu',       fn: () => okatsu(videoUrl) }
        ];

        let info     = null;
        let lastErr  = '';

        for (const api of methods) {
            try {
                const r = await api.fn();
                if (r?.download) { info = r; break; }
            } catch (e) {
                lastErr = e.message;
                console.error(`[video] ${api.name}:`, e.message);
            }
        }

        if (!info?.download) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply(`❌ *All download sources failed.*\n${lastErr ? `_${lastErr}_` : ''}`);
        }

        const title = (info.title || videoTitle || 'video').replace(/[^\w\s-]/g, '').trim() || 'video';

        // ── Send ────────────────────────────
        await conn.sendMessage(from, {
            video: { url: info.download },
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`,
            caption:
                `🎥 *${info.title || videoTitle}*\n\n` +
                `⚡ Powered by ${BOT_NAME}`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (err) {
        console.error('[video]', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* ${err.message}`);
    }
});