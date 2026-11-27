// plugins/downloader.js (YouTube සඳහා පමණක්)
const { cmd } = require('../command');
const config = require('../config');
const { youtube } = require('btch-downloader'); // btch-downloader භාවිතා කරන්න

const NEWSLETTER_JID = "120363409660898486@newsletter";

cmd({
    pattern: "yt",
    alias: ["youtube", "ytdl"],
    use: '.yt <YouTube URL>',
    desc: "Download YouTube video",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('❌ *Please provide a YouTube link.*\n\n📌 *Example:*\n.yt https://youtu.be/...');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});
        await reply('⏳ *Fetching YouTube video, please wait...*');

        const data = await youtube(q);
        if (!data.success || !data.mp4) {
            throw new Error(data.error || "No downloadable video found.");
        }

        await conn.sendMessage(from, {
            video: { url: data.mp4 },
            mimetype: 'video/mp4',
            fileName: data.title ? `${data.title}.mp4` : 'youtube_video.mp4',
            caption: `✅ *${data.title || 'YouTube Video'}*\n\n⚡ *Powered by Queen Zara*`,
            contextInfo: { /* ... newsletter context ... */ }
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
    } catch (e) {
        console.error('[yt] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* _${e.message}_`);
    }
});
