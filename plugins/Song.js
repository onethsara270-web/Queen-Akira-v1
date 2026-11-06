// plugins/song.js
const axios = require('axios');
const yts = require('yt-search');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME    = config.BOT_NAME || "Queen Zara";
const API_TIMEOUT = 120000; // Audio එකක් නිසා වෙලාව ටිකක් වැඩියෙන් දෙනවා
const FIXO_API_KEY = config.FIXO_API_KEY;
// ─────────────────────────────────────────

// ලින්ක් එකක් නැත්නම් සින්දුවේ නමින් හොයාගන්න helper function එකක්
async function getVideoUrl(query) {
    if (/youtube\.com|youtu\.be/i.test(query)) {
        return { url: query, title: 'YouTube Audio' };
    }
    const search = await yts(query);
    if (!search?.videos?.length) throw new Error("No results found for your search.");
    const video = search.videos[0];
    return { url: video.url, title: video.title };
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

    // API Key එක නැත්නම් වැඩේ කරන්නේ නෑ
    if (!FIXO_API_KEY) {
        return reply('❌ *API Key Error:*\n`config.env` එකේ FIXO_API_KEY එක දාලා නෑ. කරුණාකර ඒක හරි කරලා බොට් එක Restart කරන්න.');
    }

    const query = (q || '').trim();
    if (!query) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply('🎵 *Usage:* .song <song name or YouTube URL>');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // වීඩියෝ එකේ ලින්ක් එක හොයාගන්නවා
        const videoInfo = await getVideoUrl(query);
        
        await reply(`🎵 *Downloading Audio...*\n\n📌 ${videoInfo.title}`);

        // ── Fixo API Call ─────────────────────────────
        const apiUrl = `https://fixo-api-p15j.onrender.com/api/song?url=${encodeURIComponent(videoInfo.url)}&api_key=${FIXO_API_KEY}`;
        
        const res = await axios.get(apiUrl, {
            responseType: 'arraybuffer', // ෆයිල් එකක් නිසා arraybuffer ගන්නවා
            timeout: API_TIMEOUT,
            headers: { Accept: '*/*' },
            maxContentLength: 100 * 1024 * 1024 // 100MB
        });

        const buffer = Buffer.from(res.data, 'binary');
        if (!buffer || buffer.length === 0) {
            throw new Error("Empty audio buffer received");
        }

        // ── Send ─────────────────────────────
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
        
        let errMsg = e.message;
        if (e.code === 'ECONNABORTED') {
            errMsg = "API එක අවදි වෙන්න වෙලා ගියා හෝ ෆයිල් එක ලොකු වැඩි. ආයේ පාරක් ට්‍රයි කරන්න.";
        } else if (e.response && e.response.status === 403) {
            errMsg = "ඔයාගේ API Key එක වැරදියි හෝ Revoke කරලා තියෙනවා.";
        }

        return reply(`❌ *Error downloading song:*\n_${errMsg}_`);
    }
});
