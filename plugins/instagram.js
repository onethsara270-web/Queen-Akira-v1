const { igdl } = require('ruhend-scraper');
const { cmd } = require('../command');

cmd({
    pattern: "ig",
    alias: ["instagram", "igdl"],
    use: '.ig <link>',
    desc: "Download Instagram videos/images",
    category: "download",
    react: "📸",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q || !q.includes('instagram.com')) {
        return reply('📸 *Instagram Downloader*\n\nUsage:\n.ig <instagram post link>');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        
        const downloadData = await igdl(q.trim());
        if (!downloadData || !downloadData.data || downloadData.data.length === 0) {
            return reply('❌ No media found at the provided link.');
        }

        const items = downloadData.data;
        for (const media of items) {
            const isVideo = media.type === 'video' || media.url.match(/\.(mp4|mov|avi|mkv)$/i);
            
            if (isVideo) {
                await conn.sendMessage(from, { video: { url: media.url }, caption: '📸 *Instagram Video*' }, { quoted: mek });
            } else {
                await conn.sendMessage(from, { image: { url: media.url }, caption: '📸 *Instagram Image*' }, { quoted: mek });
            }
            await new Promise(r => setTimeout(r, 1500)); // Small delay between multiple items
        }

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
    } catch (err) {
        console.error('IG error:', err.message);
        reply('❌ Failed to download Instagram media. Please make sure the link is public.');
    }
});
