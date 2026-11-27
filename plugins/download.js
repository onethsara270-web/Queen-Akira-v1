const { cmd } = require('../command');
const config = require('../config');
const downloader = require('primesave-dl');

const NEWSLETTER_JID = "120363409660898486@newsletter";

cmd({
    pattern: "dl",
    alias: ["download", "fb", "ig", "tt", "yt"],
    use: '.dl <video URL>',
    desc: "Universal video downloader (No API Key)",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('❌ *Please provide a video link.*\n\n📌 *Example:*\n.dl https://www.tiktok.com/@user/video/123');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});
        await reply('⏳ *Fetching video, please wait...*');

        const data = await downloader(q);

        if (!data.success || !data.options || data.options.length === 0) {
            throw new Error(data.message || "No downloadable video found at that link.");
        }

        const videoOption = data.options.find(opt => opt.type === 'Video') || data.options[0];
        if (!videoOption || !videoOption.url) {
            throw new Error("Could not extract a direct video URL.");
        }

        await conn.sendMessage(from, {
            video: { url: videoOption.url },
            mimetype: 'video/mp4',
            fileName: data.title ? `${data.title}.mp4` : 'video.mp4',
            caption: `✅ *${data.title || 'Downloaded Video'}*\n\n⚡ *Powered by Queen Zara*`,
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
        console.error('[downloader] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* _${e.message}_`);
    }
});
