const axios = require('axios');
const { cmd } = require('../command');

cmd({
    pattern: "tiktok",
    alias: ["tt", "ttdl"],
    use: '.tiktok <url>',
    desc: "Download TikTok video without watermark",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('🎵 *TikTok Downloader*\n\nPlease provide a TikTok URL.\nExample:\n.tiktok https://vm.tiktok.com/XXXX');
    
    try {
        await reply('⏳ Downloading TikTok video...');
        
        const apiUrl = `https://discardapi.onrender.com/api/dl/tiktok?apikey=guru&url=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl, {
            timeout: 45000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        if (!data?.status || !data?.result) throw new Error('Invalid API response');
        
        const res = data.result;
        const hd = res.data.find((v) => v.type === 'nowatermark_hd');
        const noWm = res.data.find((v) => v.type === 'nowatermark');
        const videoUrl = hd?.url || noWm?.url;

        if (!videoUrl) throw new Error('No downloadable video found');

        const caption = `🎵 *TikTok Downloader*\n━━━━━━━━━━━━━━━━━━━\n👤 *User:* ${res.author.nickname}\n🌍 *Region:* ${res.region}\n⏱️ *Duration:* ${res.duration}\n\n❤️ *Likes:* ${res.stats.likes}\n👀 *Views:* ${res.stats.views}\n\n📝 *Caption:*\n${res.title || 'No caption'}\n\n✨ *Quality:* ${hd ? 'HD No Watermark' : 'No Watermark'}\n━━━━━━━━━━━━━━━━━━━`;

        await conn.sendMessage(from, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            caption: caption
        }, { quoted: mek });

    } catch (error) {
        console.error('TikTok error:', error.message);
        reply(`❌ Failed to download TikTok video.\nReason: ${error.message}`);
    }
});
