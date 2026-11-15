const axios = require('axios');
const { cmd } = require('../command');

cmd({
    pattern: "terabox",
    alias: ["tbox", "tbdl"],
    use: '.terabox <link>',
    desc: "Download files from TeraBox",
    category: "download",
    react: "📦",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('📦 *TeraBox Downloader*\n\nUsage:\n.terabox <terabox link>\n\nExample:\n.terabox https://terabox.com/s/xxxxx');
    if (!q.includes('terabox')) return reply('❌ *Invalid TeraBox link!*');

    try {
        await reply('⏳ *Processing TeraBox link...*\n\nPlease wait...');
        
        const apiUrl = `https://api.qasimdev.dpdns.org/api/terabox/download?apiKey=qasim-dev&url=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl, { timeout: 60000 });

        if (!data?.success || !data?.data?.files || data.data.files.length === 0) {
            throw new Error('No files found or invalid link.');
        }

        const file = data.data.files[0];
        const downloadUrl = file.downloadUrl;
        const title = file.title;
        const size = file.size;

        await reply(`📦 *File Found!*\n📄 *Name:* ${title}\n📊 *Size:* ${size}\n\n⏳ *Downloading... (This may take a while)*`);

        // Send as Document (safest for large files)
        await conn.sendMessage(from, {
            document: { url: downloadUrl },
            mimetype: 'application/octet-stream',
            fileName: title,
            caption: `✅ *Download Complete!*\n\n📄 *File:* ${title}\n📊 *Size:* ${size}\n\n> *_Downloaded via Queen Zara Mini_*`
        }, { quoted: mek });

    } catch (error) {
        console.error('TeraBox Error:', error.message);
        reply(`❌ *Download failed!*\nReason: Link expired, private, or API error.`);
    }
});
