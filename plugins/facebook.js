// plugins/facebook.js
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

function isFacebookUrl(url) {
    return /(?:facebook\.com|fb\.watch)/i.test(url);
}

cmd({
    pattern: "fb",
    alias: ["facebook", "fbdl"],
    use: '.fb <facebook url>',
    desc: "Download a Facebook video",
    category: "download",
    react: "📘",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    if (!FIXO_API_KEY) {
        return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    }

    const url = pickUrl(q || '');
    if (!url) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `❌ *Please provide a Facebook URL.*\n\n` +
            `📌 *Example:*\n` +
            `.fb https://www.facebook.com/reel/...`
        );
    }

    if (!isFacebookUrl(url)) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Not a valid Facebook link.*');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // Fixo API Call (Get Video Buffer)
        const apiUrl = `https://fixo-api-p15j.onrender.com/api/facebook?url=${encodeURIComponent(url)}&api_key=${FIXO_API_KEY}`;
        
        const res = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: API_TIMEOUT,
            headers: { Accept: '*/*' }
        });

        const buffer = Buffer.from(res.data, 'binary');
        if (!buffer || buffer.length === 0) {
            throw new Error("Empty video buffer received.");
        }

        // Forwarded Newsletter Message
        const caption =
            `✅ *FACEBOOK VIDEO*\n\n` +
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
        console.error('[facebook] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        
        let errMsg = e.message;
        if (e.code === 'ECONNABORTED') {
            errMsg = "API timeout. Server might be waking up. Please try again.";
        }

        return reply(`❌ *Error downloading Facebook video:*\n_${errMsg}_`);
    }
});
