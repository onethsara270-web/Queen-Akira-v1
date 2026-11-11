// plugins/apk.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";

cmd({
    pattern: "apk",
    alias: ["app", "apkdl"],
    use: '.apk <app name>',
    desc: "Download an APK from Play Store",
    category: "download",
    react: "📱",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    if (!q) return reply('❌ *Please provide an app name.*\n\n📌 *Example:*\n.apk whatsapp');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const apiUrl = `https://fixo-api-p15j.onrender.com/api/apk?q=${encodeURIComponent(q)}&api_key=${FIXO_API_KEY}`;
        
        // 1. API එකෙන් ලින්ක් එක සහ විස්තර ගන්නවා
        const { data } = await axios.get(apiUrl, { timeout: 30000 });

        if (!data.success || !data.url) {
            throw new Error(data.error || "App not found.");
        }

        await reply(`📥 *Downloading ${data.title}...*\n⏳ මේකට ටිකක් වෙලා යන්න පුළුවන්...`);

        // 2. APK ෆයිල් එක බාගන්නවා
        const apkRes = await axios.get(data.url, {
            responseType: 'arraybuffer',
            timeout: 180000, // ලොකු ෆයිල්ස් නිසා
            maxContentLength: 200 * 1024 * 1024 // 200MB
        });

        const buffer = Buffer.from(apkRes.data, 'binary');
        if (!buffer || buffer.length === 0) throw new Error("Empty APK buffer");

        // 3. Forwarded Message එකක් විදියට යවනවා
        const caption = 
            `✅ *APK DOWNLOADED*\n\n` +
            `📱 *App:* ${data.title}\n` +
            `👨‍💻 *Developer:* ${data.developer}\n\n` +
            `⚡ *Powered by Queen Zara*\n\n` +
            `📢 *Join our Newsletter:*\n` +
            `${NEWSLETTER_URL}`;

        await conn.sendMessage(from, {
            document: buffer,
            mimetype: 'application/vnd.android.package-archive',
            fileName: `${data.title.replace(/[^\w\s-]/g, '')}.apk`,
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
        console.error('[apk] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error downloading APK:*\n_${e.message}_`);
    }
});
