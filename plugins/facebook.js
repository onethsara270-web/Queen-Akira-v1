const axios = require('axios');
const { cmd } = require('../command');

cmd({
    pattern: "fb",
    alias: ["facebook", "fbdl"],
    use: '.fb <link>',
    desc: "Download Facebook videos",
    category: "download",
    react: "📘",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('📘 *Facebook Downloader*\n\nUsage:\n.fb <facebook video link>');
    
    const url = q.trim();
    if (!/facebook\.com|fb\.watch/i.test(url)) {
        return reply('❌ Invalid Facebook link.\nPlease send a valid Facebook video URL.');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        
        const apiUrl = `https://gtech-api-xtp1.onrender.com/api/download/fb?url=${encodeURIComponent(url)}&apikey=APIKEY`;
        const res = await axios.get(apiUrl, { timeout: 60000 });
        const videos = res?.data?.data?.data;

        if (!res?.data?.status || !Array.isArray(videos) || !videos.length) {
            throw new Error('No downloadable video found');
        }

        // Sort to get the highest quality
        const sorted = videos.sort((a, b) => {
            const qa = parseInt(a.resolution, 10) || 0;
            const qb = parseInt(b.resolution, 10) || 0;
            return qb - qa;
        });

        const selected = sorted[0];
        const videoUrl = selected.url.startsWith('http') ? selected.url : `https://gtech-api-xtp1.onrender.com${selected.url}`;
        const caption = `📘 *Facebook Downloader*\n🎞 Quality: *${selected.resolution || 'Unknown'}*\n\n> *_Downloaded by Queen Zara Mini_*`;

        await conn.sendMessage(from, { 
            video: { url: videoUrl }, 
            mimetype: 'video/mp4', 
            caption 
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
    } catch (err) {
        console.error('Facebook error:', err.message);
        reply('❌ Failed to download Facebook video. Please try again later.');
    }
});
