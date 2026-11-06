const axios = require('axios');
const yts = require('yt-search');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_KEY = config.FIXO_API_KEY;
const API_TIMEOUT = 120000;

async function getVideoUrl(query) {
    if (/youtube\.com|youtu\.be/i.test(query)) {
        return { url: query, title: 'YouTube Audio' };
    }
    const search = await yts(query);
    if (!search?.videos?.length) throw new Error("No results found.");
    return { url: search.videos[0].url, title: search.videos[0].title };
}

cmd({
    pattern: "song",
    alias: ["yta", "ytmp3", "play"],
    use: '.song <song name | youtube url>',
    desc: "Download a song as audio via Fixo API",
    category: "download",
    react: "🎵",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    if (!FIXO_API_KEY) return reply('❌ *API Key Error:* config.env එකේ FIXO_API_KEY එක දාලා නෑ.');

    const query = (q || '').trim();
    if (!query) return reply('🎵 *Usage:* .song <song name or YouTube URL>');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const videoInfo = await getVideoUrl(query);
        await reply(`🎵 *Downloading Audio...*\n\n📌 ${videoInfo.title}`);

        const apiUrl = `https://fixo-api-p15j.onrender.com/api/song?url=${encodeURIComponent(videoInfo.url)}&api_key=${FIXO_API_KEY}`;
        
        // කෙලින්ම ෆයිල් එක බෆර් කරගන්නවා
        const dl = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: API_TIMEOUT,
            maxContentLength: 100 * 1024 * 1024
        });

        const buffer = Buffer.from(dl.data, 'binary');
        if (!buffer || buffer.length === 0) throw new Error("Empty audio buffer");

        const safeName = (videoInfo.title || 'audio').replace(/[^\w\s-]/g, '').trim() || 'audio';

        await conn.sendMessage(from, {
            audio: buffer,
            mimetype: 'audio/mpeg',
            fileName: `${safeName}.mp3`,
            ptt: false
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[song] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error downloading song:*\n_${e.message}_`);
    }
});
