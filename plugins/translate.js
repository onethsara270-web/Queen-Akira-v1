// plugins/translate.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME    = "Queen Zara";
const API_TIMEOUT = 20000; 
const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";
// ─────────────────────────────────────────

cmd({
    pattern: "tr",
    alias: ["translate", "trans"],
    use: '.tr <lang> <text>',
    desc: "Translate text to another language",
    category: "utility",
    react: "🌐",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    if (!FIXO_API_KEY) {
        return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    }

    // Command එකේ හැටියට: .tr si Hello World
    if (!q || q.trim().split(' ').length < 2) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `❌ *Please provide a language code and text.*\n\n` +
            `📌 *Example:*\n` +
            `.tr si Hello how are you?`
        );
    }

    const args = q.trim().split(' ');
    const targetLang = args[0].toLowerCase(); // e.g., 'si'
    const textToTranslate = args.slice(1).join(' '); // e.g., 'Hello how are you?'

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // Fixo API Call
        const apiUrl = `https://fixo-api-p15j.onrender.com/api/translate?text=${encodeURIComponent(textToTranslate)}&to=${targetLang}&api_key=${FIXO_API_KEY}`;
        
        const { data } = await axios.get(apiUrl, {
            timeout: API_TIMEOUT,
            headers: { Accept: 'application/json' }
        });

        if (!data.success || !data.translated) {
            throw new Error(data.error || "Translation failed.");
        }

        // Forwarded Newsletter Message
        const responseText =
            `🌐 *TRANSLATION*\n\n` +
            `📝 *Original (${data.from}):*\n${data.original}\n\n` +
            `✅ *Translated (${data.to}):*\n${data.translated}\n\n` +
            `⚡ *Powered by ${BOT_NAME}*\n\n` +
            `📢 *Join our Newsletter:*\n` +
            `${NEWSLETTER_URL}`;

        await conn.sendMessage(from, {
            text: responseText,
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
        console.error('[translate] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        
        let errMsg = e.message;
        if (e.code === 'ECONNABORTED') errMsg = "API timeout. Server might be waking up. Please try again.";

        return reply(`❌ *Error translating text:*\n_${errMsg}_`);
    }
});
