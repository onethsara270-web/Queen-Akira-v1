// plugins/base64.js
const config = require('../config');
const { cmd } = require('../command');

// ── Branding ──────────────────────────────
const BOT_NAME = "Queen Zara";
// ──────────────────────────────────────────

cmd({
    pattern: "base64",
    alias: ["b64", "encode", "decode"],
    use: '.base64 enc <text> | .base64 dec <base64>',
    desc: "Encode or decode Base64 text",
    category: "tools",
    react: "🔐",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const args = (q || '').trim().split(/\s+/);
    const action = (args[0] || '').toLowerCase();
    const text   = args.slice(1).join(' ');

    try {
        // ── No args ──────────────────────────
        if (!q) {
            return reply(
                `⚠️ *Usage:*\n` +
                `.base64 enc Hello World\n` +
                `.base64 dec SGVsbG8gV29ybGQ=\n\n` +
                `📌 *Example:*\n` +
                `.base64 enc Hello World`
            );
        }

        if (!text) {
            return reply(
                '❌ *Please provide text to encode/decode!*\n\n' +
                `Example:\n` +
                `.base64 enc Hello World\n` +
                `.base64 dec SGVsbG8gV29ybGQ=`
            );
        }

        // ── Encode ───────────────────────────
        if (action === 'enc' || action === 'encode') {
            const result = Buffer.from(text).toString('base64');

            await reply(
                `🔐 *BASE64 ENCODER* 🔐\n\n` +
                `📝 *Original:*\n${text}\n\n` +
                `🔒 *Encoded:*\n\`${result}\`\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `⚡ Powered by ${BOT_NAME}`
            );

            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
            return;
        }

        // ── Decode ───────────────────────────
        if (action === 'dec' || action === 'decode') {
            // Base64 වලට වලංගු අකුරු පමණක් ද බලනවා
            if (!/^[A-Za-z0-9+/=\s]+$/.test(text)) {
                await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
                return reply('❌ *Invalid Base64 string!*\n\nPlease check your input and try again.');
            }

            const result = Buffer.from(text, 'base64').toString('utf8');

            await reply(
                `🔓 *BASE64 DECODER* 🔓\n\n` +
                `🔒 *Encoded:*\n${text}\n\n` +
                `📝 *Decoded:*\n\`${result}\`\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `⚡ Powered by ${BOT_NAME}`
            );

            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
            return;
        }

        // ── Invalid action ───────────────────
        return reply(
            `⚠️ *Invalid action!*\n\n` +
            `*Usage:*\n` +
            `.base64 enc Hello World\n` +
            `.base64 dec SGVsbG8gV29ybGQ=\n\n` +
            `*Actions:*\n` +
            `• enc / encode - Encode text to Base64\n` +
            `• dec / decode - Decode Base64 to text`
        );

    } catch (error) {
        console.error('[base64]', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* ${error.message}`);
    }
});