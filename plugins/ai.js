// plugins/ai.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";

cmd({
    pattern: "ai",
    alias: ["imagine", "gen"],
    use: '.ai <prompt>',
    desc: "Generate an image using AI",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    if (!q) return reply('❌ *Please provide a prompt.*\n\n📌 *Example:*\n.ai a cyberpunk city at night');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});
        await reply(`🎨 *Generating AI image for:*\n"${q}"\n\n⏳ This might take a few seconds...`);

        const apiUrl = `https://fixo-api-p15j.onrender.com/api/ai-image?prompt=${encodeURIComponent(q)}&api_key=${FIXO_API_KEY}`;
        
        const res = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 60000
        });

        const buffer = Buffer.from(res.data, 'binary');

        if (!buffer || buffer.length === 0) {
            throw new Error("Empty image buffer received.");
        }

        const caption = 
            `✅ *AI IMAGE GENERATED*\n\n` +
            `📝 *Prompt:* ${q}\n\n` +
            `⚡ *Powered by Queen Zara*\n\n` +
            `📢 *Join our Newsletter:*\n` +
            `${NEWSLETTER_URL}`;

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
        console.error('[ai] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error generating AI image:*\n_${e.message}_`);
    }
});
