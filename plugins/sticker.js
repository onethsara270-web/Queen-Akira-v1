// plugins/sticker.js
const axios = require('axios');
const FormData = require('form-data');
const { Sticker, StickerTypes } = require('wa-sticker-formatter'); // අලුත් පැකේජ් එක
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
}, async (conn, mek, m, { from, reply }) => {

    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');

    try {
        let mediaMsg = null;

        // 1. කෙලින්ම එවපු ඉමේජ් එකක්ද බලනවා
        const isDirectImage = mek.mtype === 'imageMessage' || mek.message?.imageMessage;
        
        // 2. රිප්ලයි කරපු ඉමේජ් එකක්ද බලනවා
        const quotedMsg = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isQuotedImage = quotedMsg && quotedMsg.imageMessage;

        if (isDirectImage) {
            mediaMsg = mek;
        } else if (isQuotedImage) {
            mediaMsg = m.quoted || { message: quotedMsg };
        }

        if (!mediaMsg) {
            return reply(`❌ *Please reply to an image or send an image with the caption.*\n\n📌 *Example:*\n.sticker`);
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // 3. ඉමේජ් එක ඩවුන්ලෝඩ් කරගන්නවා
        let buffer;
        try {
            if (mediaMsg.download) {
                buffer = await mediaMsg.download();
            } else {
                buffer = await conn.downloadMediaMessage(mediaMsg);
            }
        } catch (err) {
            throw new Error("Failed to download media from WhatsApp");
        }

        if (!buffer) throw new Error("Media buffer is empty");

        // 4. Fixo API එකට යවන්න FormData එකක් හදනවා (WebP එකක් ගන්නවා)
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });

        const apiUrl = `https://fixo-api-p15j.onrender.com/api/sticker?api_key=${FIXO_API_KEY}`;
        
        const res = await axios.post(apiUrl, form, {
            headers: { ...form.getHeaders() },
            responseType: 'arraybuffer',
            timeout: API_TIMEOUT
        });

        const webpBuffer = Buffer.from(res.data, 'binary');

        if (!webpBuffer || webpBuffer.length === 0) {
            throw new Error("Empty sticker buffer received from API.");
        }

        // 5. අලුත් පැකේජ් එකෙන් EXIF Data (Pack Name) එක දානවා
        const sticker = new Sticker(webpBuffer, {
            pack: "Queen Zara 🧚",      // ⬅️ මෙතන තමයි යටින් පේන නම වෙනස් වෙන්නේ
            author: "Fixo Dev",       // ⬅️ Pack එකේ Author ගේ නම
            type: StickerTypes.FULL,
            quality: 90
        });

        const finalStickerBuffer = await sticker.toBuffer();

        // 6. Sticker එක යවනවා
        await conn.sendMessage(from, {
            sticker: finalStickerBuffer,
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
