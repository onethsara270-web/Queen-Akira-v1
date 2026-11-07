// plugins/instagram.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME    = "Queen Zara";
const API_TIMEOUT = 60000; 
const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";
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
    desc: "Download an Instagram video/reel",
    category: "download",
    react: "📸",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');

    const url = pickUrl(q || '');
    if (!url) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(`❌ *Please provide an Instagram URL.*\n\n📌 *Example:*\n.ig https://www.instagram.com/reel/...`);
    }

    if (!isInstagramUrl(url)) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Not a valid Instagram link.*');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // 1. Fixo API Call (Link එක ගන්නවා)
        const apiUrl = `https://fixo-api-p15j.onrender.com/api/instagram?url=${encodeURIComponent(url)}&api_key=${FIXO_API_KEY}`;
        const { data } = await axios.get(apiUrl, { timeout: 20000 });

        if (!data.success || !data.video_url) {
            throw new Error(data.error || "Failed to get video URL from API.");
        }

        // 2. ලින්ක් එකෙන් වීඩියෝ එක බාගන්නවා
        const videoRes = await axios.get(data.video_url, {
            responseType: 'arraybuffer',
            timeout: API_TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const buffer = Buffer.from(videoRes.data, 'binary');
        if (!buffer || buffer.length === 0) throw new Error("Empty video buffer received.");

        // 3. Forwarded Newsletter Message එකක් විදියට යවනවා
        const caption =
            `✅ *INSTAGRAM VIDEO*\n\n` +
            `⚡ *Powered by ${BOT_NAME}*\n\n` +
            `📢 *Join our Newsletter:*\n` +
            `${NEWSLETTER_URL}`;

        await conn.sendMessage(from, {
            video: buffer,
            caption: caption,
            mimetype: 'video/mp4',
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: NEWSLETTER_JID,
                    newsletterName: "Fixo API Updates",
                    serverMessageId: -1
                }
            }
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[instagram] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        
        let errMsg = e.message;
        if (e.code === 'ECONNABORTED') errMsg = "API timeout. Server might be waking up. Please try again.";
        
        return reply(`❌ *Error downloading Instagram video:*\n_${errMsg}_`);
    }
});
