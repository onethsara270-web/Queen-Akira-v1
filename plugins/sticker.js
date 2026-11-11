// plugins/sticker.js
const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME    = "Queen Zara";
const API_TIMEOUT = 30000; 
const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";
// ─────────────────────────────────────────

cmd({
    pattern: "sticker",
    alias: ["s", "stiker"],
    use: '.sticker (reply to image)',
    desc: "Convert an image to a WhatsApp sticker",
    category: "utility",
    react: "🎨",
    filename: __filename
}, async (conn, mek, m, { from, reply, isMedia, quoted, mime }) => {

    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');

    try {
        // 1. ඉමේජ් එකක්ද කියලා චෙක් කරනවා (reply කරපු එක හෝ කෙලින්ම එවපු එක)
        let isImage = false;
        let mediaMsg = null;

        if (isMedia && /image/.test(mime)) {
            isImage = true;
            mediaMsg = mek;
        } else if (quoted && quoted.mtype === 'imageMessage') {
            isImage = true;
            mediaMsg = quoted;
        }

        if (!isImage) {
            return reply(`❌ *Please reply to an image or send an image with the caption.*\n\n📌 *Example:*\n.sticker`);
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // 2. WhatsApp එකෙන් ඉමේජ් එක ඩවුන්ලෝඩ් කරගන්නවා
        const stream = await conn.downloadMediaMessage(mediaMsg);
        const buffer = Buffer.from(stream);

        // 3. Fixo API එකට යවන්න FormData එකක් හදනවා
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });

        const apiUrl = `https://fixo-api-p15j.onrender.com/api/sticker?api_key=${FIXO_API_KEY}`;
        
        const res = await axios.post(apiUrl, form, {
            headers: {
                ...form.getHeaders(),
            },
            responseType: 'arraybuffer',
            timeout: API_TIMEOUT
        });

        const stickerBuffer = Buffer.from(res.data, 'binary');

        if (!stickerBuffer || stickerBuffer.length === 0) {
            throw new Error("Empty sticker buffer received.");
        }

        // 4. Forwarded Newsletter Message එකක් විදියට Sticker එක යවනවා
        const caption =
            `✅ *STICKER CREATED*\n\n` +
            `⚡ *Powered by ${BOT_NAME}*\n\n` +
            `📢 *Join our Newsletter:*\n` +
            `${NEWSLETTER_URL}`;

        await conn.sendMessage(from, {
            sticker: stickerBuffer,
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
        console.error('[sticker] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        
        let errMsg = e.message;
        if (e.code === 'ECONNABORTED') errMsg = "API timeout. Server might be waking up. Please try again.";

        return reply(`❌ *Error creating sticker:*\n_${errMsg}_`);
    }
});
