// plugins/song.js
const axios = require('axios');
const yts = require('yt-search');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME    = "Queen Zara";
const API_TIMEOUT = 60000;
const DL_TIMEOUT  = 120000;
// ─────────────────────────────────────────

// Optional converter — must exist for non-mp3 sources
let toAudio = null;
try { ({ toAudio } = require('../lib/converter')); }
catch { console.warn('[song] lib/converter missing — non-mp3 sources will send raw'); }

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*'
};

// ── Retry wrapper ─────────────────────────
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
        `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp3`,
        { timeout: API_TIMEOUT, headers: HEADERS }
    ));
    if (r?.data?.success && r?.data?.downloadURL) return { download: r.data.downloadURL, title: r.data.title };
    throw new Error('eliteProTech no download');
}

async function yupra(url) {
    const r = await tryRequest(() => axios.get(
        `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,
        { timeout: API_TIMEOUT, headers: HEADERS }
    ));
    if (r?.data?.success && r?.data?.data?.download_url) {
        return { download: r.data.data.download_url, title: r.data.data.title };
    }
    throw new Error('yupra no download');
}

async function okatsu(url) {
    const r = await tryRequest(() => axios.get(
        `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`,
        { timeout: API_TIMEOUT, headers: HEADERS }
    ));
    if (r?.data?.dl) return { download: r.data.dl, title: r.data.title };
    throw new Error('okatsu no download');
}

async function alya(url) {
    const r = await axios.get(
        `https://api.alyachan.pro/api/ytmp3?url=${encodeURIComponent(url)}&apikey=G7I6X7`,
        { timeout: API_TIMEOUT, headers: HEADERS, validateStatus: s => s < 500 }
    );
    if (r.data?.status && r.data?.data?.url) return { download: r.data.data.url, title: r.data.data.title };
    throw new Error('alya no download');
}

async function vreden(url) {
    const r = await axios.get(
        `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(url)}`,
        { timeout: API_TIMEOUT, headers: HEADERS, validateStatus: s => s < 500 }
    );
    if (r.data?.status && r.data?.result?.download?.url) {
        return { download: r.data.result.download.url, title: r.data.result.metadata?.title };
    }
    throw new Error('vreden no download');
}

// ── Detect audio container ────────────────
function detectExt(buf) {
    const head = buf.slice(0, 12);
    if (head.slice(4, 8).toString('ascii') === 'ftyp') return 'm4a';
    if (head.toString('ascii', 0, 4) === 'OggS')       return 'ogg';
    if (head.toString('ascii', 0, 4) === 'RIFF')       return 'wav';
    return 'mp3';
}

cmd({
    pattern: "song",
    alias: ["yta", "ytmp3", "play"],
    use: '.song <song name | youtube url>',
    desc: "Download a song as audio",
    category: "download",
    react: "🎵",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const query = (q || '').trim();
    if (!query) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply('🎵 *Usage:* .song <song name or YouTube URL>');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── Resolve video ────────────────────
        let video;
        if (/youtube\.com|youtu\.be/i.test(query)) {
            video = { url: query, title: 'YouTube Audio', thumbnail: null };
        } else {
            const search = await yts(query);
            if (!search?.videos?.length) {
                await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
                return reply('❌ *No results found.*');
            }
            video = search.videos[0];
        }

        // ── Info preview ─────────────────────
        try {
            if (video.thumbnail) {
                await conn.sendMessage(from, {
                    image: { url: video.thumbnail },
                    caption:
                        `🎵 *Downloading...*\n\n` +
                        `📌 *Title:* ${video.title}\n` +
                        `⏱ *Duration:* ${video.timestamp || 'N/A'}`
                }, { quoted: mek });
            } else {
                await reply(`🎵 *Downloading...*\n\n📌 ${video.title}`);
            }
        } catch { /* non-critical */ }

        // ── Try each API until buffer arrives ──
        const methods = [
            { name: 'eliteProTech', fn: () => eliteProTech(video.url) },
            { name: 'yupra',        fn: () => yupra(video.url) },
            { name: 'okatsu',       fn: () => okatsu(video.url) },
            { name: 'alya',         fn: () => alya(video.url) },
            { name: 'vreden',       fn: () => vreden(video.url) }
        ];

        let buffer   = null;
        let title    = video.title;
        let usedApi  = '';
        let lastErr  = '';

        for (const api of methods) {
            try {
                const info = await api.fn();
                if (!info?.download) throw new Error('empty download');

                const dl = await axios.get(info.download, {
                    responseType: 'arraybuffer',
                    timeout: DL_TIMEOUT,
                    headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' },
                    maxContentLength: 100 * 1024 * 1024,
                    validateStatus: s => s < 400
                });

                const buf = Buffer.from(dl.data);
                if (buf.length > 0) {
                    buffer  = buf;
                    title   = info.title || title;
                    usedApi = api.name;
                    break;
                }
            } catch (e) {
                lastErr = e.message;
                console.error(`[song] ${api.name}:`, e.message);
            }
        }

        if (!buffer) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply(
                `❌ *All sources failed.*\n\n` +
                (lastErr ? `_${lastErr}_` : '')
            );
        }

        // ── Convert if needed ────────────────
        const ext = detectExt(buffer);
        let finalBuffer = buffer;

        if (ext !== 'mp3' && toAudio) {
            try { finalBuffer = await toAudio(buffer, ext); }
            catch (e) {
                console.error('[song] convert:', e.message);
                finalBuffer = buffer;   // send raw anyway
            }
        }

        // ── Send ─────────────────────────────
        const safeName = (title || 'audio').replace(/[^\w\s-]/g, '').trim() || 'audio';

        await conn.sendMessage(from, {
            audio: finalBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${safeName}.mp3`,
            ptt: false
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

        // Tiny source note — optional, keep out of caption
        console.log(`[song] sent via ${usedApi} (${buffer.length} bytes, ${ext} → mp3)`);

    } catch (err) {
        console.error('[song]', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* ${err.message}`);
    }
});