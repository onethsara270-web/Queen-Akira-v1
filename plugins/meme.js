// plugins/meme.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
// ─────────────────────────────────────────

cmd({
    pattern: "meme",
    alias: ["cheems", "memes"],
    use: '.meme',
    desc: "Get a random meme",
    category: "fun",
    react: "🎭",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── Try image APIs first ────────────
        const imageApis = [
            'https://shizoapi.onrender.com/api/memes/cheems?apikey=shizo',
            'https://meme-api.com/gimme',
            'https://api.imgflip.com/get_memes'
        ];

        let buffer = null;

        // 1. shizoapi
        try {
            const res = await axios.get(imageApis[0], { responseType: 'arraybuffer', timeout: 15000 });
            const ct = res.headers['content-type'] || '';
            if (ct.includes('image')) buffer = Buffer.from(res.data);
        } catch (e) {
            console.error('[meme] shizo:', e.message);
        }

        // 2. meme-api.com (JSON → url)
        if (!buffer) {
            try {
                const { data } = await axios.get(imageApis[1], { timeout: 15000 });
                if (data?.url) {
                    const img = await axios.get(data.url, { responseType: 'arraybuffer', timeout: 15000 });
                    buffer = Buffer.from(img.data);
                }
            } catch (e) {
                console.error('[meme] meme-api:', e.message);
            }
        }

        // 3. imgflip (random)
        if (!buffer) {
            try {
                const { data } = await axios.get(imageApis[2], { timeout: 15000 });
                const list = data?.data?.memes;
                if (list?.length) {
                    const pick = list[Math.floor(Math.random() * list.length)];
                    const img = await axios.get(pick.url, { responseType: 'arraybuffer', timeout: 15000 });
                    buffer = Buffer.from(img.data);
                }
            } catch (e) {
                console.error('[meme] imgflip:', e.message);
            }
        }

        if (!buffer) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *Failed to fetch a meme.* Try again in a bit.');
        }

        await conn.sendMessage(from, {
            image: buffer,
            caption: `> Here's your meme! 🎭\n\n⚡ Powered by ${BOT_NAME}`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[meme]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Failed to fetch meme.*');
    }
});