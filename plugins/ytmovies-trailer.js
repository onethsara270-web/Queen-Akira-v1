const axios = require('axios');
const { cmd } = require('../command');
const yts = require('yt-search');

function waitForReply(conn, from, messageId, timeout = 60000) {
    return new Promise((resolve) => {
        const handler = async (msgData) => {
            try {
                const msg = msgData.messages[0];
                if (!msg || !msg.message || msg.key.remoteJid !== from) return;
                const quoted = msg.message.extendedTextMessage?.contextInfo?.stanzaId;
                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                if (quoted === messageId || text) {
                    resolve(msg);
                    conn.ev.off('messages.upsert', handler);
                }
            } catch (e) { console.error('Wait Error:', e); }
        };
        conn.ev.on('messages.upsert', handler);
        setTimeout(() => { conn.ev.off('messages.upsert', handler); resolve(null); }, timeout);
    });
}

cmd({
    pattern: "movietrailer",
    alias: ["ytmt", "trailer", "filmtrailer"],
    desc: "Search and download movie trailers",
    category: "media",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, reply, text }) => {
    try {
        if (!text) return reply(`🎬 *Movie Downloader*\n\n1️⃣ \`.movietrailer Avenger\`\n2️⃣ Reply with number 1-10 to download.`);

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        const searchResults = await yts(text + ' movie trailer');
        if (!searchResults || !searchResults.videos || searchResults.videos.length === 0) return reply(`🌸 No movies found for "${text}"!`);

        const movieList = searchResults.videos.slice(0, 10);
        let listText = `🌸 *Search Results for: ${text}*\n\n`;

        movieList.forEach((movie, index) => {
            listText += `*${index + 1}.* ${movie.title}\n`;
        });
        listText += `\n👉 *Reply with the number (1-10)* to download.`;

        const sentMsg = await conn.sendMessage(from, { text: listText }, { quoted: mek });
        
        const replyMsg = await waitForReply(conn, from, sentMsg.key.id, 60000);
        if (!replyMsg) return reply(`🌸 Timeout! Please search again.`);

        const replyText = replyMsg.message.conversation || replyMsg.message.extendedTextMessage?.text || '';
        const num = parseInt(replyText.trim());

        if (isNaN(num) || num < 1 || num > movieList.length) return reply(`🌸 Invalid number! Please reply with 1-${movieList.length}.`);

        const selectedMovie = movieList[num - 1];
        await conn.sendMessage(from, { react: { text: '📥', key: replyMsg.key } });

        const apiUrl = `https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(selectedMovie.url)}`;
        const dlMsg = await reply(`📥 *Downloading:* ${selectedMovie.title}...`);

        const { data } = await axios.get(apiUrl, { timeout: 60000 });
        const downloadUrl = data?.result?.download?.url;

        if (!downloadUrl) return reply(`🌸 Could not retrieve download link!`);

        const response = await axios({ method: 'GET', url: downloadUrl, responseType: 'arraybuffer', timeout: 300000 });
        const fileBuffer = Buffer.from(response.data);
        
        await conn.sendMessage(from, { delete: dlMsg.key });

        await conn.sendMessage(from, {
            document: fileBuffer,
            mimetype: "video/mp4",
            fileName: `${selectedMovie.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`,
            caption: `🎬 *${selectedMovie.title}*\n\n👑 Powered by Queen Zara Mini`
        }, { quoted: replyMsg });

        await conn.sendMessage(from, { react: { text: '💖', key: replyMsg.key } });
    } catch (err) {
        console.error('🌸 Movie Error:', err);
        reply(`🌸 Movie download failed: ${err.message || 'Unknown error'}`);
    }
});
