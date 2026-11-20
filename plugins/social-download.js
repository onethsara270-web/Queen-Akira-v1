const { cmd } = require('../command');
const axios = require('axios');
const config = require('../config');

// ============================================
// 📘 FACEBOOK DOWNLOAD
// ============================================
cmd({
    pattern: "fb",
    alias: ["facebook", "fbdl"],
    desc: "Download Facebook video",
    category: "download",
    react: "🌸",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q || (!q.includes("facebook.com") && !q.includes("fb.watch"))) return reply("🌸 Valid Facebook URL ekak denna.");
        
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });
        const api = `https://arslan-apis-v2.vercel.app/download/fbdown?url=${encodeURIComponent(q)}`;
        const { data } = await axios.get(api, { timeout: 60000 });

        if (!data || data.status !== true || !data.result || !data.result.status) return reply("🌸 Facebook video fetching Error 💕");

        const download = data.result.download || {};
        const videoUrl = download.hd || download.sd || download.p480;
        if (!videoUrl) return reply("🌸 Download link ekak hambunee ne 💕");

        await conn.sendMessage(from, {
            video: { url: videoUrl },
            mimetype: "video/mp4",
            caption: `🌸 *Facebook Video*\n\n👑 *Powered by Queen Zara Mini*`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "💖", key: mek.key } });
    } catch (err) {
        reply("🌸 Error aagaya, thawa sarayak try karanna 💕");
    }
});

// ============================================
// 📥 INSTAGRAM DOWNLOAD
// ============================================
cmd({
    pattern: "igdl",
    alias: ["instagram", "insta", "ig"],
    desc: "Download Instagram videos/reels",
    category: "download",
    react: "🌸",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        const url = q || m.quoted?.text;
        if (!url || !url.includes("instagram.com")) return reply("🌸 Instagram link ekak denna 💕");

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/igdl?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl);

        if (!response.data?.status || !response.data.data?.length) return reply("🌸 Failed to fetch media 💕");

        for (const item of response.data.data) {
            await conn.sendMessage(from, {
                [item.type === 'video' ? 'video' : 'image']: { url: item.url },
                caption: `🌸 *Instagram Downloader*\n\n👑 Powered by Queen Zara Mini`
            }, { quoted: mek });
        }
        await conn.sendMessage(from, { react: { text: '💖', key: mek.key } });
    } catch (error) {
        reply("🌸 Download failed. Try again later. 💕");
    }
});

// ============================================
// 🎵 TIKTOK DOWNLOAD
// ============================================
cmd({
    pattern: "tiktok",
    alias: ["ttdl", "tiktokdl", "tt"],
    desc: "Download TikTok videos",
    category: "download",
    react: "🌸",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        const tiktokUrl = q || m.quoted?.text;
        if (!tiktokUrl || !tiktokUrl.includes("tiktok.com")) return reply('🌸 TikTok URL ekak denna 💕');

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const apiUrl = `https://api.nexoracle.com/downloader/tiktok-nowm?apikey=free_key@maher_apis&url=${encodeURIComponent(tiktokUrl)}`;
        const response = await axios.get(apiUrl);

        if (!response.data || response.data.status !== 200 || !response.data.result) return reply('🌸 Unable to fetch video 💕');

        const { title, author, url } = response.data.result;
        const videoResponse = await axios.get(url, { responseType: 'arraybuffer' });
        
        await conn.sendMessage(from, {
            video: Buffer.from(videoResponse.data, 'binary'),
            caption: `🌸 *TikTok Video*\n\n🔖 *Title*: ${title || "No title"}\n👤 *Author*: @${author.username}\n\n👑 Powered by Queen Zara Mini`,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.NEWSLETTER_JID || '120363409660898486@newsletter',
                    newsletterName: 'Queen Zara Mini',
                    serverMessageId: 143
                }
            }
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '💖', key: mek.key } });
    } catch (error) {
        reply('🌸 Unable to download. Try again later. 💕');
    }
});

// ============================================
// 📦 MEDIAFIRE DOWNLOAD
// ============================================
cmd({
    pattern: "mediafire",
    alias: ["mfire", "media"],
    desc: "Download files from MediaFire",
    category: "download",
    react: "🌸",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q || !q.includes("mediafire.com")) return reply('🌸 MediaFire URL ekak denna 💕');

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const apiUrl = `https://arslan-apis.zone.id/download/mfire?url=${encodeURIComponent(q)}`;
        const response = await axios.get(apiUrl);

        if (!response.data || !response.data.status) return reply('🌸 Unable to fetch file 💕');
        const { fileName, fileType, size, dl_link } = response.data.result;

        const fileResponse = await axios.get(dl_link, { responseType: 'arraybuffer' });
        
        await conn.sendMessage(from, {
            document: Buffer.from(fileResponse.data, 'binary'),
            mimetype: fileType || 'application/octet-stream',
            fileName: fileName || 'mediafire_file',
            caption: `🌸 *MediaFire Download*\n\n📂 *Name*: ${fileName}\n📦 *Size*: ${size}\n\n👑 Powered by Queen Zara Mini`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '💖', key: mek.key } });
    } catch (error) {
        reply('🌸 Unable to download. Try again later. 💕');
    }
});

// ============================================
// 📦 APK DOWNLOAD
// ============================================
cmd({
    pattern: "apk",
    alias: ["modapk", "apkdownload"],
    desc: "Download APK files",
    category: "download",
    react: "🌸",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply('🌸 App name ekak denna. Ex: .apk whatsapp 💕');

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const apiUrl = `https://api.nexoracle.com/downloader/apk`;
        const response = await axios.get(apiUrl, { params: { apikey: 'free_key@maher_apis', q: q } });

        if (!response.data || response.data.status !== 200) return reply('🌸 APK ekak hambunee ne 💕');
        const { name, size, icon, dllink } = response.data.result;

        const apkResponse = await axios.get(dllink, { responseType: 'arraybuffer' });

        await conn.sendMessage(from, {
            document: Buffer.from(apkResponse.data, 'binary'),
            mimetype: 'application/vnd.android.package-archive',
            fileName: `${name}.apk`,
            caption: `🌸 *APK Details*\n\n🔖 *Name*: ${name}\n📏 *Size*: ${size}\n\n👑 Powered by Queen Zara Mini`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '💖', key: mek.key } });
    } catch (error) {
        reply('🌸 Unable to fetch APK. Try again later. 💕');
    }
});

console.log('🌸 Queen Zara Mini - Download plugins loaded! 💖');
