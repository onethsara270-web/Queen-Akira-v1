// plugins/mediafire.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";

function pickUrl(s = '') {
    const m = String(s).match(/https?:\/\/\S+/i);
    return m ? m[0] : '';
}

cmd({
    pattern: "mediafire",
    alias: ["mf", "mfdl"],
    use: '.mediafire <link>',
    desc: "Download a file from MediaFire",
    category: "download",
    react: "📁",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    
    const url = pickUrl(q || '');
    if (!url || !url.includes('mediafire.com')) {
        return reply('❌ *Please provide a valid MediaFire link.*\n\n📌 *Example:*\n.mediafire https://www.mediafire.com/file/...');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});
        await reply(`📥 *Downloading file from MediaFire...*\n⏳ මේකට ටිකක් වෙලා යන්න පුළුවන්...`);

        const apiUrl = `https://fixo-api-p15j.onrender.com/api/mediafire?url=${encodeURIComponent(url)}&api_key=${FIXO_API_KEY}`;
        
        const res = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 180000, // ලොකු ෆයිල්ස් නිසා තත්පර 180ක් දෙනවා
            maxContentLength: 200 * 1024 * 1024 // Max 200MB
        });

        const buffer = Buffer.from(res.data, 'binary');

        if (!buffer || buffer.length === 0) {
            throw new Error("Empty file buffer received.");
        }

        // ෆයිල් එකේ නම Header එකෙන් ගන්නවා
        let fileName = 'mediafire_file';
        const disposition = res.headers['content-disposition'];
        if (disposition && disposition.includes('filename=')) {
            fileName = decodeURIComponent(disposition.split('filename=')[1].replace(/["']/g, ''));
        }

        const caption = 
            `✅ *MEDIAFIRE DOWNLOAD*\n\n` +
            `📁 *File:* ${fileName}\n` +
            `⚡ *Powered by Queen Zara*\n\n` +
            `📢 *Join our Newsletter:*\n` +
            `${NEWSLETTER_URL}`;

        await conn.sendMessage(from, {
            document: buffer,
            mimetype: res.headers['content-type'] || 'application/octet-stream',
            fileName: fileName,
            caption: caption,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: NEWSLETTER_JID,
                    newsletterName: "Fixo API Updates",
                    serverMessageId: -1
                }
            }
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
    } catch (e) {
        console.error('[mediafire] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        
        let errMsg = e.message;
        if (e.code === 'ECONNABORTED') errMsg = "Download timeout. File might be too large.";

        return reply(`❌ *Error downloading MediaFire file:*\n_${errMsg}_`);
    }
});
