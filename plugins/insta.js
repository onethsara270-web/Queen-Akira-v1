// plugins/instagram.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME    = config.BOT_NAME || "Queen Zara";
const API_TIMEOUT = 30000; 
const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486"; // Newsletter Link
// ─────────────────────────────────────────

function pickUrl(s = '') {
    const m = String(s).match(/https?:\/\/\S+/i);
    return m ? m[0] : '';
}

function isInstagramUrl(url) {
    return /(?:instagram\.com|instagr\.am)/i.test(url);
}

cmd({
    pattern: "ig",
    alias: ["insta", "igdl", "reels"],
    use: '.ig <instagram url>',
    desc: "Download an Instagram video/reel via Fixo API",
    category: "download",
    react: "📸",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    if (!FIXO_API_KEY) {
        return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    }

    const url = pickUrl(q || '');
    if (!url) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `❌ *Please provide an Instagram URL.*\n\n` +
            `📌 *Example:*\n` +
            `.ig https://www.instagram.com/reel/...`
        );
    }

    if (!isInstagramUrl(url)) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Not a valid Instagram link.*');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── Fixo API Call ─────────────────────────────
        const apiUrl = `https://fixo-api-p15j.onrender.com/api/instagram?url=${encodeURIComponent(url)}&api_key=${FIXO_API_KEY}`;
        
        const { data } = await axios.get(apiUrl, {
            timeout: API_TIMEOUT,
            headers: { Accept: 'application/json' }
        });

        if (!data.success || !data.video_url) {
            throw new Error(data.error || "Failed to get video URL from API.");
        }

        // ── Download Video Buffer ─────────────────────
        const videoRes = await axios.get(data.video_url, {
            responseType: 'arraybuffer',
            timeout: API_TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const buffer = Buffer.from(videoRes.data, 'binary');

        // ── Send ─────────────────────────────
        const caption =
            `✅ *INSTAGRAM VIDEO*\n\n` +
            `⚡ *Powered by ${BOT_NAME}*\n\n` +
            `📢 *Join our Newsletter:*\n` +
            `${NEWSLETTER_URL}`;

        await conn.sendMessage(from, {
            video: buffer,
            caption: caption,
            mimetype: 'video/mp4'
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[instagram] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        
        let errMsg = e.message;
        if (e.code === 'ECONNABORTED') {
            errMsg = "API timeout. Server might be waking up. Please try again.";
        }

        return reply(`❌ *Error downloading Instagram video:*\n_${errMsg}_`);
    }
});
