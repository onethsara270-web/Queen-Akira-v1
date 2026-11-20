const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_URL = "https://fixo-api-t71c.onrender.com";
const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";

function pickUrl(s = '') {
    const m = String(s).match(/https?:\/\/\S+/i);
    return m ? m[0] : '';
}

cmd({
    pattern: "ig",
    alias: ["insta", "igdl", "reels"],
    use: '.ig <url>',
    desc: "Download Instagram Video",
    category: "download",
    react: "📸",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    const url = pickUrl(q || '');
    if (!url) return reply('❌ *Please provide an Instagram URL.*');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});
        await reply(`📥 *Downloading Instagram Video...*\n⏳ Please wait...`);

        const apiUrl = `${FIXO_API_URL}/api/instagram?url=${encodeURIComponent(url)}&api_key=${FIXO_API_KEY}`;
        
        const res = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 120000 });
        const buffer = Buffer.from(res.data, 'binary');
        
        if (!buffer || buffer.length === 0) throw new Error("Empty video buffer.");

        await conn.sendMessage(from, {
            video: buffer,
            mimetype: 'video/mp4',
            caption: `✅ *INSTAGRAM VIDEO*\n\n⚡ *Powered by Queen Zara*\n📢 ${NEWSLETTER_URL}`,
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
        return reply(`❌ *Error downloading Instagram video:*\n_${e.message}_`);
    }
});
