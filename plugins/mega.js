const { File } = require('megajs');
const path = require('path');
const { cmd } = require('../command');

cmd({
    pattern: "mega",
    alias: ["megadl"],
    use: '.mega <url>',
    desc: "Download from MEGA",
    category: "download",
    react: "🌩️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q || !q.includes('mega.nz')) return reply('🌩️ *Usage:* .mega https://mega.nz/file/xxxx#xxxx');

    try {
        await reply('⏳ *Connecting to MEGA...*');
        
        const file = File.fromURL(q);
        await file.loadAttributes();

        if (file.size >= 500 * 1024 * 1024) {
            return reply('❌ *Error:* File too large (Limit: 500MB for WhatsApp).');
        }

        await reply(`🌩️ *File Found:* ${file.name}\n📊 *Size:* ${(file.size / (1024 * 1024)).toFixed(2)} MB\n\n⏳ *Downloading... (Please wait)*`);

        const buffer = await file.downloadBuffer();
        const ext = path.extname(file.name).toLowerCase();

        await conn.sendMessage(from, {
            document: buffer,
            fileName: file.name,
            mimetype: 'application/octet-stream',
            caption: `✅ *Download Complete!*\n\n📄 *Name:* ${file.name}\n📊 *Size:* ${(file.size / (1024 * 1024)).toFixed(2)} MB`
        }, { quoted: mek });

    } catch (error) {
        console.error('Mega error:', error.message);
        reply(`❌ *Error:* ${error.message}`);
    }
});
