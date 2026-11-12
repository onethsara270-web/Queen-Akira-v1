// plugins/base64.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";

cmd({
    pattern: "base64",
    alias: ["b64"],
    use: '.base64 <enc/dec> <text>',
    desc: "Encode or Decode Base64",
    category: "utility",
    react: "🔐",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    
    const args = (q || '').trim().split(' ');
    if (args.length < 2 || !['enc', 'dec', 'encode', 'decode'].includes(args[0].toLowerCase())) {
        return reply(
            `❌ *Please provide text to encode/decode!*\n\n` +
            `📌 *Example:*\n` +
            `.base64 enc Hello World\n` +
            `.base64 dec SGVsbG8gV29ybGQ=`
        );
    }

    const action = args[0].toLowerCase().startsWith('e') ? 'encode' : 'decode';
    const textToProcess = args.slice(1).join(' ');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const apiUrl = `https://fixo-api-p15j.onrender.com/api/base64?text=${encodeURIComponent(textToProcess)}&action=${action}&api_key=${FIXO_API_KEY}`;
        const res = await axios.get(apiUrl, { timeout: 20000, validateStatus: s => s < 500 });
        
        if (!res.data.success) {
            throw new Error(res.data.error || "Failed to process Base64.");
        }

        const data = res.data;

        const caption = 
            `🔐 *BASE64 ${data.action.toUpperCase()}*\n\n` +
            `📝 *Input:*\n${data.original}\n\n` +
            `✅ *Result:*\n${data.result}\n\n` +
            `⚡ *Powered by Queen Zara*\n\n` +
            `📢 *Join our Newsletter:*\n` +
            `${NEWSLETTER_URL}`;

        await conn.sendMessage(from, {
            text: caption,
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
        console.error('[base64] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error processing Base64:*\n_${e.message}_`);
    }
});
