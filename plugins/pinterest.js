// plugins/pinterest.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// ─────────────────────────────────────────

// ── Try Pinterest resource endpoint ────
async function fromPinterest(q) {
    const url =
        `https://www.pinterest.com/resource/BaseSearchResource/get/` +
        `?source_url=${encodeURIComponent('/search/pins/?q=' + q)}` +
        `&data=${encodeURIComponent(JSON.stringify({
            options: { filters: '', page_size: 10 },
            context: {}
        }))}`;

    const { data } = await axios.get(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        timeout: 12000,
        validateStatus: s => s === 200
    });

    const results = data?.resource_response?.data?.results || [];
    const pin = results.find(r => r.images?.orig?.url || r.images?.large?.url);
    if (!pin) return null;

    return {
        url: pin.images.orig?.url || pin.images.large?.url || pin.images.medium?.url,
        title: pin.title || pin.grid_title || q,
        author: pin.pinner?.full_name || 'Pinterest'
    };
}

// ── Pollinations (AI image) — always works ──
function fromPollinations(q) {
    const prompt = q.replace(/[^\w\s]/g, ' ').trim() || 'beautiful scenery';
    return {
        url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`,
        title: q,
        author: 'AI Generated'
    };
}

cmd({
    pattern: "pinterest",
    alias: ["pin", "pint"],
    use: '.pinterest <search term>',
    desc: "Search for an image on Pinterest (AI fallback)",
    category: "search",
    react: "📌",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const query = (q || '').trim();
    if (!query) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `📌 *Pinterest Image Search*\n\n` +
            `📌 *Usage:* .pinterest [search_term]\n\n` +
            `📝 *Example:*\n` +
            `.pinterest beautiful sunset`
        );
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        let result = null;

        // ── 1. Pinterest ────────────────────
        try { result = await fromPinterest(query); }
        catch (e) { console.error('[pinterest] pinterest:', e.message); }

        // ── 2. Pollinations fallback ────────
        if (!result) result = fromPollinations(query);

        const caption =
            `📌 *Pinterest Search Results*\n\n` +
            `🔍 *Search:* ${query}\n` +
            `📷 *Image:* ${result.title}\n` +
            `👤 *Source:* ${result.author}\n\n` +
            `⚡ Powered by ${BOT_NAME}`;

        await conn.sendMessage(from, {
            image: { url: result.url },
            caption
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[pinterest]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Search failed:*\n_${e.message}_`);
    }
});