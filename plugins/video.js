// plugins/video.js
const axios = require('axios');
const yts = require('yt-search');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_KEY = config.FIXO_API_KEY;
const API_TIMEOUT = 180000;

async function getVideoUrl(query) {
    if (/youtube\.com|youtu\.be/i.test(query)) {
        return { url: query, title: 'YouTube Video' };
    }
    const search = await yts(query);
    if (!search?.videos?.length) throw new Error("No results found.");
    return { url: search.videos[0].url, title: search.videos[0].title };
}

cmd({
    pattern: "video",
    alias: ["ytv", "ytmp4", "mp4"],
    use: '.video <video name | youtube url>',
    desc: "Download a video as MP4 via Fixo API",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    if (!FIXO_API_KEY) return reply('❌ *API Key Error:* config.env එකේ FIXO_API_KEY එක දාලා නෑ.');

    const query = (q || '').trim();
    if (!query) return reply('🎬 *Usage:* .video <video name or YouTube URL>');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const videoInfo = await getVideoUrl(query);
        await reply(`🎬 *Downloading Video...*\n\n📌 ${videoInfo.title}\n⏳ මේකට ටිකක් වෙලා යන්න පුළුවන්...`);

        // 1. Fixo API එකෙන් ඩවුන්ලෝඩ් ලින්ක් එක ගන්නවා (JSON)
        const apiUrl = `https://fixo-api-p15j.onrender.com/api/video?url=${encodeURIComponent(videoInfo.url)}&api_key=${FIXO_API_KEY}`;
        const apiRes = await axios.get(apiUrl, { timeout: 20000 });

        if (!apiRes.data.success || !apiRes.data.download_url) {
            throw new Error("API එකෙන් ලින්ක් එක ගන්න බැරි වුනා");
        }

        // 2. ඒ ලින්ක් එකෙන් ෆයිල් එක ඩවුන්ලෝඩ් කරගන්නවා (Buffer)
        const dl = await axios.get(apiRes.data.download_url, {
            responseType: 'arraybuffer',
            timeout: API_TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            maxContentLength: 200 * 1024 * 1024
        });

        const buffer = Buffer.from(dl.data, 'binary');
        if (!buffer || buffer.length === 0) throw new Error("Empty video buffer");

        const safeName = (apiRes.data.title || 'video').replace(/[^\w\s-]/g, '').trim() || 'video';

        // 3. යවනවා
        await conn.sendMessage(from, {
            video: buffer,
            mimetype: 'video/mp4',
            fileName: `${safeName}.mp4`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[video] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error downloading video:*\n_${e.message}_`);
    }
});
