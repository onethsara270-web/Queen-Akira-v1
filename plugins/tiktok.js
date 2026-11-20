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
        
        const { data } = await axios.get(apiUrl, { 
            timeout: 30000,
            validateStatus: () => true 
        });

        if (!data.success || !data.video_url) {
            throw new Error(data.error || "Failed to extract video link.");
        }

        // title එක undefined නම් 'TikTok Video' කියලා පෙන්නන්න
        const safeTitle = (data.title && data.title !== 'undefined') ? data.title : 'TikTok Video';

        await reply(`📥 *Downloading...*\n📌 ${safeTitle}`);

        // ⚠️ වීඩියෝ එක බාගන්නකොට Headers දෙනවා (මේකෙන් තමයි බ්ලොක් එක මගහැරෙන්නේ)
        const videoRes = await axios.get(data.video_url, { 
            responseType: 'arraybuffer', 
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.tiktok.com/'
            }
        });

        const buffer = Buffer.from(videoRes.data, 'binary');

        if (!buffer || buffer.length === 0) throw new Error("Empty video buffer.");

        await conn.sendMessage(from, {
            video: buffer,
            mimetype: 'video/mp4',
            caption: `✅ *TIKTOK VIDEO*\n\n📌 ${safeTitle}\n👤 ${data.author}\n\n⚡ *Powered by Queen Zara*\n📢 ${NEWSLETTER_URL}`,
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
