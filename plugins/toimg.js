const { cmd } = require('../command');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

cmd({
    pattern: "toimg",
    alias: ["toimage", "stickertoimg"],
    use: '.toimg (reply to sticker)',
    desc: "Convert sticker to image",
    category: "utility",
    react: "🖼️",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    if (!m.quoted || m.quoted.mtype !== 'stickerMessage') {
        return reply('❌ *Please reply to a sticker.*');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        
        // Sticker එක ඩවුන්ලෝඩ් කරනවා
        let buffer = await m.quoted.download();

        // Sticker එක Image එකක් විදියට Convert කරනවා
        const sticker = new Sticker(buffer, {
            type: StickerTypes.CROPPED,
            quality: 100
        });

        const pngBuffer = await sticker.toBuffer();

        await conn.sendMessage(from, { 
            image: pngBuffer, 
            caption: '🖼️ *Converted from Sticker*' 
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
    } catch (error) {
        console.error('ToImg Error:', error);
        reply('❌ Failed to convert sticker to image.');
    }
});
