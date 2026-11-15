const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

cmd({
    pattern: "catbox",
    alias: ["cb", "upload"],
    use: '.catbox (reply to media)',
    desc: "Upload media to Catbox.moe",
    category: "upload",
    react: "📤",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        if (!m.quoted) return reply('⚠️ Please reply to an image, video, or document!');

        const type = m.quoted.mtype;
        const supportedTypes = ['imageMessage', 'videoMessage', 'stickerMessage', 'documentMessage'];

        if (!supportedTypes.includes(type)) return reply('⚠️ Unsupported type! Reply to media.');

        await reply('⏳ Uploading to Catbox...');

        let buffer = await m.quoted.download();
        
        let ext = 'bin';
        if (type === 'imageMessage') ext = 'jpg';
        else if (type === 'videoMessage') ext = 'mp4';
        else if (type === 'stickerMessage') ext = 'webp';

        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const tempPath = path.join(tempDir, `catbox_${Date.now()}.${ext}`);
        fs.writeFileSync(tempPath, buffer);

        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', fs.createReadStream(tempPath));

        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            timeout: 120000
        });

        await reply(`✅ *Upload Successful!*\n\n🔗 *URL:* ${response.data}\n\n_Link is permanent._`);
        
        fs.unlinkSync(tempPath);
    } catch (error) {
        console.error('Catbox Error:', error);
        reply(`❌ Error: ${error.message}`);
    }
});
