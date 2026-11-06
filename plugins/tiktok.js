// plugins/tiktok.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME    = "Queen Zara";
const API_TIMEOUT = 30000; // Render free tier එක නිදාගෙන ඉන්න පුළුවන් නිසා ටයිම් එක වැඩි කළා
// ඔයාගේ Fixo API key එක මෙතන දාන්න (නැත්නම් config එකෙන් ගන්න හදන්න)
const FIXO_API_KEY = config.FIXO_API_KEY || process.env.FIXO_API_KEY || "fixo_ඔයාගේ_key_එක_මෙතන_daන්න";
// ─────────────────────────────────────────

function pickUrl(s = '') {
    const m = String(s).match(/https?:\/\/\S+/i);
    return m ? m[0] : '';
}

function isTikTokUrl(url) {
    return /(?:tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)/i.test(url);
}

cmd({
    pattern: "tiktok",
    alias: ["tt", "ttdl", "tikwm"],
    use: '.tiktok <tiktok url>',
    desc: "Download a TikTok video via Fixo API",
    category: "download",
    react: "📱",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const url = pickUrl(q || '');
    if (!url) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `❌ *Please provide a TikTok URL.*\n\n` +
            `📌 *Example:*\n` +
            `.tiktok https://www.tiktok.com/@user/video/123...`
        );
    }

    if (!isTikTokUrl(url)) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Not a valid TikTok link.*');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── Fixo API Call ─────────────────────────────
        const apiUrl = `https://fixo-api-p15j.onrender.com/api/tiktok?url=${encodeURIComponent(url)}&api_key=${FIXO_API_KEY}`;
        
        const { data } = await axios.get(apiUrl, {
            timeout: API_TIMEOUT,
            headers: { Accept: 'application/json' }
        });

        // API එකෙන් success එකක් ආවේ නැත්නම් error එකක් දෙන්න
        if (!data.success || !data.video_url) {
            throw new Error("API එකෙන් වීඩියෝ එක ගන්න බැරි වුනා");
        }

        // ── Send ─────────────────────────────
        const caption =
            `✅ *TIKTOK VIDEO*\n\n` +
            `📌 *Title:* ${data.title}\n` +
            `👤 *Author:* ${data.author}\n\n` +
            `⚡ Powered by ${BOT_NAME}`;

        // වීඩියෝ එක කෙලින්ම URL එකෙන් යවනවා (Buffer ඕන නෑ, ඒක ලේසියි)
        await conn.sendMessage(from, {
            video: { url: data.video_url },
            caption: caption,
            mimetype: 'video/mp4'
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[tiktok] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        
        // Render API එක sleep වෙලා නම් එන එරර් එක ලස්සනට පෙන්නනවා
        let errMsg = e.message;
        if (e.code === 'ECONNABORTED') {
            errMsg = "API එක අවදි වෙන්න වෙලා ගියා. ආයේ පාරක් ට්‍රයි කරන්න.";
        }

        return reply(`❌ *Error downloading TikTok:*\n_${errMsg}_`);
    }
});
