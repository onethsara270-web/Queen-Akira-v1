// plugins/tiktok.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_URL = "https://fixo-api-t71c.onrender.com"; // ඔයාගේ ලින්ක් එක
const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";

function pickUrl(s = '') {
    const m = String(s).match(/https?:\/\/\S+/i);
    return m ? m[0] : '';
}

cmd({
    pattern: "tiktok",
    alias: ["tt", "ttdl"],
    use: '.tiktok <url>',
    desc: "Download TikTok Video",
    category: "download",
    react: "📱",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    const url = pickUrl(q || '');
    if (!url) return reply('❌ *Please provide a TikTok URL.*');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});
        
        const apiUrl = `${FIXO_API_URL}/api/tiktok?url=${encodeURIComponent(url)}&api_key=${FIXO_API_KEY}`;
        
        // validateStatus දැම්මම 500 Error එකක් ආවත් ක්‍රෑෂ් වෙන්නේ නෑ
        const { data } = await axios.get(apiUrl, { 
            timeout: 30000,
            validateStatus: () => true 
        });

        if (!data.success || !data.video_url) {
            throw new Error(data.error || "Failed to extract video link.");
        }

        await reply(`📥 *Downloading...*\n📌 ${data.title}`);

        const videoRes = await axios.get(data.video_url, { responseType: 'arraybuffer', timeout: 60000 });
        const buffer = Buffer.from(videoRes.data, 'binary');

        if (!buffer || buffer.length === 0) throw new Error("Empty video buffer.");

        await conn.sendMessage(from, {
            video: buffer,
            mimetype: 'video/mp4',
            caption: `✅ *TIKTOK VIDEO*\n\n📌 ${data.title}\n👤 ${data.author}\n\n⚡ *Powered by Queen Zara*\n📢 ${NEWSLETTER_URL}`,
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
        return reply(`❌ *Error downloading TikTok:*\n_${e.message}_`);
    }
});
