// plugins/apk.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Branding ──────────────────────────────
const BOT_NAME       = "Queen Zara";
const NEWSLETTER_JID = "120363409660898486@newsletter";
// ──────────────────────────────────────────

cmd({
    pattern: "apk",
    alias: ["apkdl", "getapk", "downloadapk"],
    use: '.apk <app name>',
    desc: "Search & download APK from Aptoide",
    category: "download",
    react: "⬇️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isGroup, sender }) => {

    const query = (q || '').trim();

    if (!query) {
        return reply("🔍 *කරුණාකර app එකේ නම ඇතුළත් කරන්න.*\n\n_උදා:_\n.apk Instagram");
    }

    try {
        await conn.sendMessage(from, { react: { text: "⬇️", key: mek.key } });

        const apiUrl = `https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(query)}&limit=1`;
        const { data } = await axios.get(apiUrl, { timeout: 20000 });

        const app = data?.datalist?.list?.[0];

        if (!app) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ *ඔබගේ සෙවීමට ගැලපෙන APK එකක් හමු නොවීය.*");
        }

        const fileUrl = app.file?.path_alt || app.file?.path;
        if (!fileUrl) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ *මේ app එකට බාගත කළ හැකි APK file එකක් නැහැ.*");
        }

        const bytes   = Number(app.size || app.file?.filesize || 0);
        const sizeMB  = bytes ? (bytes / (1024 * 1024)).toFixed(2) : "?";
        const updated = (app.updated || app.added || "").split(" ")[0] || "?";

        const caption = `
🎮 *App Name:* ${app.name}
📦 *Package:* ${app.package}
📅 *Last Updated:* ${updated}
📁 *Size:* ${sizeMB} MB

> > ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${BOT_NAME} 🔥
        `.trim();

        await conn.sendMessage(from, { react: { text: "⬆️", key: mek.key } });

        const contextInfo = {
            mentionedJid: [sender],
            forwardingScore: 999,
            isForwarded: true
        };
        if (!isGroup) {
            contextInfo.forwardedNewsletterMessageInfo = {
                newsletterJid: NEWSLETTER_JID,
                newsletterName: BOT_NAME,
                serverMessageId: 143
            };
        }

        await conn.sendMessage(from, {
            document: { url: fileUrl },
            fileName: `${app.name}.apk`,
            mimetype: 'application/vnd.android.package-archive',
            caption,
            contextInfo
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.error("[apk]", e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
        return reply(`❌ *APK බාගත කිරීමේදී දෝෂයක් ඇති විය.*\n\n_${e.message}_`);
    }
});