// plugins/translate.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
const TIMEOUT  = 15000;
// ─────────────────────────────────────────

// ── API helpers ───────────────────────────
async function googleTranslate(text, lang) {
    const { data } = await axios.get(
        `https://translate.googleapis.com/translate_a/single` +
        `?client=gtx&sl=auto&tl=${encodeURIComponent(lang)}&dt=t` +
        `&q=${encodeURIComponent(text)}`,
        { timeout: TIMEOUT }
    );
    return data?.[0]?.[0]?.[0] || null;
}

async function myMemory(text, lang) {
    const { data } = await axios.get(
        `https://api.mymemory.translated.net/get` +
        `?q=${encodeURIComponent(text)}&langpair=auto|${encodeURIComponent(lang)}`,
        { timeout: TIMEOUT }
    );
    return data?.responseData?.translatedText || null;
}

async function dreaded(text, lang) {
    const { data } = await axios.get(
        `https://api.dreaded.site/api/translate` +
        `?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`,
        { timeout: TIMEOUT, validateStatus: s => s < 500 }
    );
    return data?.translated || null;
}

const PROVIDERS = [
    { name: 'google',   fn: googleTranslate },
    { name: 'mymemory', fn: myMemory },
    { name: 'dreaded',  fn: dreaded }
];

// ── Extract quoted text ───────────────────
function getQuotedText(m) {
    const ctx = m.message?.extendedTextMessage?.contextInfo
             || m.message?.imageMessage?.contextInfo
             || m.message?.videoMessage?.contextInfo
             || {};
    const q = ctx.quotedMessage;
    if (!q) return '';
    return (
        q.conversation ||
        q.extendedTextMessage?.text ||
        q.imageMessage?.caption ||
        q.videoMessage?.caption ||
        ''
    );
}

cmd({
    pattern: "translate",
    alias: ["trt", "tr"],
    use: '.translate <text> <lang> | reply <lang>',
    desc: "Translate text or a quoted message",
    category: "tools",
    react: "🌐",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const input = (q || '').trim();
    const quoted = getQuotedText(m);

    let textToTranslate = '';
    let lang = '';

    // ── Parse ───────────────────────────────
    if (quoted) {
        // Reply mode: last token = lang
        if (!input) {
            await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
            return reply(
                `🌐 *TRANSLATOR*\n\n` +
                `Reply to a message with:\n` +
                `.translate <lang>\n\n` +
                `*Example:* .translate fr`
            );
        }
        textToTranslate = quoted;
        lang = input;
    } else {
        const parts = input.split(/\s+/).filter(Boolean);
        if (parts.length < 2) {
            await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
            return reply(
                `🌐 *TRANSLATOR*\n\n` +
                `*Usage:*\n` +
                `1. Reply + \`.translate <lang>\`\n` +
                `2. Type \`.translate <text> <lang>\`\n\n` +
                `*Language codes:*\n` +
                `fr, es, de, it, pt, ru, ja, ko, zh, ar, hi, si, ta, en`
            );
        }
        lang = parts.pop();
        textToTranslate = parts.join(' ');
    }

    if (!textToTranslate) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *No text found to translate.*');
    }

    // ── Typing indicator (best-effort) ──────
    try {
        await conn.presenceSubscribe?.(from);
        await conn.sendPresenceUpdate?.('composing', from);
    } catch { /* not supported */ }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        let translated = null;
        let usedProvider = '';

        for (const p of PROVIDERS) {
            try {
                const out = await p.fn(textToTranslate, lang);
                if (out && typeof out === 'string' && out.trim() && out.trim() !== textToTranslate) {
                    translated = out.trim();
                    usedProvider = p.name;
                    break;
                }
            } catch (e) {
                console.error(`[translate] ${p.name}:`, e.message);
            }
        }

        if (!translated) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *All translation APIs failed.* Try again later.');
        }

        const header =
            `🌐 *TRANSLATION* (→ ${lang.toUpperCase()})\n\n`;

        await reply(`${header}${translated}`);

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[translate]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(
            `❌ *Translation failed.*\n\n` +
            `*Usage:*\n` +
            `Reply: \`.translate <lang>\`\n` +
            `Direct: \`.translate <text> <lang>\``
        );
    }
});