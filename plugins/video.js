const axios = require('axios');
const yts = require('yt-search');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_URL = "https://fixo-api-t71c.onrender.com";
const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";

async function getVideoUrl(query) {
    if (/youtube\.com|youtu\.be/i.test(query)) return { url: query, title: 'YouTube Video' };
    const search = await yts(query);
    if (!search?.videos?.length) throw new Error("No results found.");
    return { url: search.videos[0].url, title: search.videos[0].title };
}

cmd({
    pattern: "video",
    alias: ["ytv", "ytmp4", "mp4"],
    use: '.video <video name | youtube url>',
    desc: "Download a video as MP4",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    const query = (q || '').trim();
    if (!query) return reply('🎬 *Usage:* .video <video name or YouTube URL>');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});
        const videoInfo = await getVideoUrl(query);
        await reply(`🎬 *Downloading Video...*\n\n📌 ${videoInfo.title}\n⏳ Please wait...`);

        const apiUrl = `${FIXO_API_URL}/api/video?url=${encodeURIComponent(videoInfo.url)}&api_key=${FIXO_API_KEY}`;
        
        const res = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 180000,
            maxContentLength: 200 * 1024 * 1024
        });

        const buffer = Buffer.from(res.data, 'binary');
        if (!buffer || buffer.length === 0) throw new Error("Empty video buffer");

        const safeName = (videoInfo.title || 'video').replace(/[^\w\s-]/g, '').trim() || 'video';

        await conn.sendMessage(from, {
            video: buffer,
            mimetype: 'video/mp4',
            fileName: `${safeName}.mp4`,
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
        return reply(`❌ *Error downloading video:*\n_${e.message}_`);
    }
});
