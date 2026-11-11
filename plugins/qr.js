// plugins/qr.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";

cmd({
    pattern: "qr",
    alias: ["qrcode"],
    use: '.qr <text or url>',
    desc: "Generate a QR code",
    category: "utility",
    react: "🔲",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    if (!q) return reply('❌ *Please provide text or a URL.*\n\n📌 *Example:*\n.qr hello world');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const apiUrl = `https://fixo-api-p15j.onrender.com/api/qr?text=${encodeURIComponent(q)}&api_key=${FIXO_API_KEY}`;
        const res = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 20000 });

        const buffer = Buffer.from(res.data, 'binary');

        const caption = `✅ *QR CODE*\n\n⚡ *Powered by Queen Zara*\n\n📢 *Join our Newsletter:*\n${NEWSLETTER_URL}`;

        await conn.sendMessage(from, {
            image: buffer,
            caption: caption,
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
        return reply(`❌ *Error generating QR:*\n_${e.message}_`);
    }
});
