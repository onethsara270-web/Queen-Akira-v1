const axios = require('axios');
const yts = require('yt-search');
const { cmd } = require('../command');

cmd({
    pattern: "audio",
    alias: ["mp3", "song", "gana", "play", "ytmp3", "ytaudio", "playaudio", "music"],
    desc: "Download YouTube Audio as MP3",
    category: "download",
    react: "🎵",
    filename: __filename
}, async (conn, mek, m, { from, reply, text }) => {
    try {
        if (!text) return reply("🎵 Example:\n.audio pasoori\n.audio https://youtu.be/xxx");

        let videoUrl, title, artist, duration, thumbnail, views;
        const isUrl = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(text);

        if (isUrl) {
            videoUrl = text;
            const search = await yts(text);
            if (search?.videos?.length) {
                const vid = search.videos[0];
                title = vid.title; artist = vid.author?.name || 'Unknown'; duration = vid.timestamp; thumbnail = vid.thumbnail; views = vid.views;
            } else { title = "YouTube Audio"; artist = "Unknown"; }
        } else {
            const search = await yts(text);
            if (!search.videos.length) return reply("🎵 No audio found. Please try another song!");
            const vid = search.videos[0];
            videoUrl = vid.url; title = vid.title; artist = vid.author?.name || 'Unknown'; duration = vid.timestamp; thumbnail = vid.thumbnail; views = vid.views;
        }

        const caption = `
╭────────────────────◇
│  🎵 QUEEN ZARA MUSIC 🎵
│  ✌︎㋡━━━━━━━━━✌︎㋡
│  ✿ 🎶 Title: ${title.slice(0, 30)}...
│  ✿ 👩‍🎤 Artist: ${artist}
│  ✿ ⏱️ Duration: ${duration || 'Unknown'}
│  ✿ 👁️ Views: ${views || 'N/A'}
│  ✿ 📥 Processing...
╰────────────────────○
> 🦋 Powered by Queen Zara Mini
        `;

        await conn.sendMessage(from, { image: { url: thumbnail || 'https://i.ibb.co/CKz1Cm4h/Neon-Queen-Zara-Anime-Banner.png' }, caption: caption }, { quoted: mek });

        const apiUrl = `https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(videoUrl)}`;
        const { data } = await axios.get(apiUrl, { timeout: 60000 });

        const downloadUrl = data?.result?.download_url || data?.result?.downloadUrl || data?.result?.url || data?.url || data?.link || data?.result?.download?.url;
        if (!downloadUrl) throw new Error('Could not retrieve download link.');

        await conn.sendMessage(from, { audio: { url: downloadUrl }, mimetype: 'audio/mpeg', ptt: false }, { quoted: mek });

    } catch (err) {
        console.error('🎵 Audio Error:', err);
        reply(`🎵 Audio download failed: ${err.message || 'Unknown error'}`);
    }
});
