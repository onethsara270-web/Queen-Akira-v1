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
    desc: "Download an APK",
    category: "download",
    react: "📱",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    if (!q) return reply('❌ *Please provide an app name.*\n\n📌 *Example:*\n.apk whatsapp');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const apiUrl = `https://fixo-api-p15j.onrender.com/api/apk?q=${encodeURIComponent(q)}&api_key=${FIXO_API_KEY}`;
        const res = await axios.get(apiUrl, { timeout: 30000, validateStatus: s => s < 500 });
        
        if (!res.data.success || !res.data.url) {
            throw new Error(res.data.error || "App not found.");
        }

        const data = res.data;
        await reply(`📥 *Downloading ${data.title}...*\n📁 Size: ${data.size}\n⏳ Please wait...`);

        // APK එක බාගන්නවා
        const apkRes = await axios.get(data.url, {
            responseType: 'arraybuffer',
            timeout: 180000,
            maxContentLength: 200 * 1024 * 1024, // 200MB
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const buffer = Buffer.from(apkRes.data, 'binary');
        if (!buffer || buffer.length === 0) throw new Error("Empty APK buffer received.");

        // ඇප් එකේ නමින් ෆයිල් එක හදනවා
        const safeName = (data.title || 'app').replace(/[^\w\s-]/g, '').trim() || 'app';

        const caption = 
            `✅ *APK DOWNLOADED*\n\n` +
            `📱 *App:* ${data.title}\n` +
            `📦 *Package:* ${data.package}\n` +
            `📁 *Size:* ${data.size}\n\n` +
            `⚡ *Powered by Queen Zara*\n\n` +
            `📢 *Join our Newsletter:*\n` +
            `${NEWSLETTER_URL}`;

        await conn.sendMessage(from, {
            document: buffer,
            mimetype: 'application/vnd.android.package-archive',
            fileName: `${safeName}.apk`,
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
