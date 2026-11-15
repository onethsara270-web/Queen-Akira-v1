const yts = require('yt-search');
const axios = require('axios');
const { cmd } = require('../command');

const DL_API = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const API_KEY = 'qasim-dev';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

cmd({
    pattern: "play",
    alias: ["song", "mp3", "audio"],
    use: '.play <song name>',
    desc: "Download song from YouTube",
    category: "music",
    react: "🎵",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('❌ *Which song do you want to play?*\nUsage: .play <song name>');
    
    try {
        await reply('🔍 *Searching...*');
        const { videos } = await yts(q);
        if (!videos?.length) return reply('❌ *No results found!*');
        
        const video = videos[0];
        await reply(`✅ *Found:* ${video.title}\n⏱️ ${video.timestamp}\n👤 ${video.author.name}\n\n⏳ *Downloading...*`);
        
        // Download API
        let audioData = null;
        for (let i = 0; i < 3; i++) {
            try {
                const { data } = await axios.get(DL_API, {
                    params: { apiKey: API_KEY, format: 'mp3', url: video.url },
                    timeout: 90000
                });
                if (data?.data?.downloadUrl) { audioData = data.data; break; }
            } catch (e) { await wait(5000); }
        }

        if (!audioData) throw new Error('Download failed after 3 attempts');

        await conn.sendMessage(from, {
            audio: { url: audioData.downloadUrl },
            mimetype: 'audio/mpeg',
            fileName: `${video.title}.mp3`,
            contextInfo: {
                externalAdReply: {
                    title: video.title,
                    body: `${video.author.name} • ${video.timestamp}`,
                    mediaType: 2,
                    thumbnailUrl: video.thumbnail,
                    sourceUrl: video.url
                }
            }
        }, { quoted: mek });
        
    } catch (err) {
        console.error('Play error:', err.message);
        reply(`❌ *Failed:* ${err.message}`);
    }
});
