// plugins/tts.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";

cmd({
    pattern: "tts",
    alias: ["say", "voice"],
    use: '.tts <text>',
    desc: "Convert text to speech",
    category: "utility",
    react: "🗣️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    if (!q) return reply('❌ *Please provide text.*\n\n📌 *Example:*\n.tts Hello how are you?');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const apiUrl = `https://fixo-api-p15j.onrender.com/api/tts?text=${encodeURIComponent(q)}&api_key=${FIXO_API_KEY}`;
        const res = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 30000 });

        const buffer = Buffer.from(res.data, 'binary');

        const caption = `✅ *TEXT TO SPEECH*\n\n⚡ *Powered by Queen Zara*\n\n📢 *Join our Newsletter:*\n${NEWSLETTER_URL}`;

        // Voice note එකක් විදියට (ptt: true) යවනවා
        await conn.sendMessage(from, {
            audio: buffer,
            mimetype: 'audio/mp4',
            ptt: true,
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
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error generating TTS:*\n_${e.message}_`);
    }
});
