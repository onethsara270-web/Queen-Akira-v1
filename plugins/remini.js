const axios = require('axios');
const FormData = require('form-data');
const { cmd } = require('../command');

cmd({
    pattern: "hd",
    alias: ["remini", "enhance"],
    use: '.hd (reply to image)',
    desc: "Enhance image quality to HD",
    category: "tools",
    react: "✨",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    if (!m.quoted || m.quoted.mtype !== 'imageMessage') {
        return reply('❌ *Please reply to an image!*\n\nExample: Reply to a blurry photo and type .hd');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        
        // ඉමේජ් එක ඩවුන්ලෝඩ් කරගන්නවා
        const buffer = await m.quoted.download();

        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg' });

        // API එකට යවනවා
        const res = await axios.post('https://api.qasimdev.dpdns.org/api/imageenhancer', form, {
            headers: { ...form.getHeaders() },
            responseType: 'arraybuffer',
            timeout: 60000
        });

        const enhancedBuffer = Buffer.from(res.data);

        await conn.sendMessage(from, { 
            image: enhancedBuffer, 
            caption: '✨ *Image Enhanced Successfully!*\n\n> _Powered by Queen Zara Mini_'
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
    } catch (error) {
        console.error('HD Error:', error.message);
        reply('❌ *Failed to enhance image.* The server might be busy.');
    }
});
