// plugins/joke.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
// ─────────────────────────────────────────

cmd({
    pattern: "joke",
    alias: ["dadjoke", "funny"],
    use: '.joke',
    desc: "Get a random dad joke",
    category: "fun",
    react: "😂",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        let joke = null;

        // ── 1. icanhazdadjoke ────────────────
        try {
            const { data } = await axios.get('https://icanhazdadjoke.com/', {
                headers: { Accept: 'application/json' },
                timeout: 15000
            });
            if (data?.joke) joke = data.joke;
        } catch (e) {
            console.error('[joke] icanhazdadjoke:', e.message);
        }

        // ── 2. Fallback: official-joke-api ───
        if (!joke) {
            try {
                const { data } = await axios.get('https://official-joke-api.appspot.com/random_joke', {
                    timeout: 15000
                });
                if (data?.setup && data?.punchline) {
                    joke = `${data.setup}\n\n${data.punchline}`;
                }
            } catch (e) {
                console.error('[joke] official-joke-api:', e.message);
            }
        }

        // ── Result ───────────────────────────
        if (!joke) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('😅 *Could not fetch a joke right now.* Try again in a bit.');
        }

        await reply(`😂 *DAD JOKE*\n\n${joke}\n\n⚡ Powered by ${BOT_NAME}`);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (error) {
        console.error('[joke]', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('😅 *Could not fetch a joke right now.*');
    }
});