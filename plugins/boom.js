// plugins/boom.js
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME   = "Queen Zara";
const MAX_COUNT  = 20;
const DELAY_MS   = 700;
// ─────────────────────────────────────────

cmd({
    pattern: "boom",
    alias: ["bomb", "spam"],
    use: '.boom <number>,<message>,<count>',
    desc: "Send repeated messages to a target number",
    category: "tools",
    react: "👽",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    // ── Parse: number,message,count ──────
    const parts    = (q || '').split(',').map(x => (x || '').trim());
    const target   = parts[0];
    const message  = parts[1];
    const countRaw = parts[2];
    const count    = parseInt(countRaw, 10) || 5;

    // ── Validation ───────────────────────
    if (!target || !message) {
        return reply(
            `👽 *Usage:* .boom <number>,<message>,<count>\n\n` +
            `*Example:*\n` +
            `.boom 94703945265,Hello 👋,5`
        );
    }

    if (count > MAX_COUNT) {
        return reply(`❌ *Limit is ${MAX_COUNT} messages per bomb.*`);
    }

    if (count < 1) {
        return reply('❌ *Count must be at least 1.*');
    }

    // ── Target JID ───────────────────────
    const digits = target.replace(/[^0-9]/g, '');
    if (digits.length < 8 || digits.length > 15) {
        return reply('❌ *Invalid number.* Use country code + number, e.g. 94703945265');
    }
    const jid = `${digits}@s.whatsapp.net`;

    // ── Send loop ────────────────────────
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < count; i++) {
        try {
            await conn.sendMessage(jid, { text: message });
            sent++;
        } catch (e) {
            failed++;
            console.error(`[boom] fail → ${jid} (${i + 1}/${count}):`, e.message);
        }
        if (i < count - 1) {
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }

    await conn.sendMessage(from, { react: { text: sent ? '✅' : '❌', key: mek.key } }).catch(() => {});

    return reply(
        `👽 *BOOM COMPLETE*\n\n` +
        `📱 *Target:* ${digits}\n` +
        `✅ *Sent:* ${sent}\n` +
        `❌ *Failed:* ${failed}\n\n` +
        `⚡ Powered by ${BOT_NAME}`
    );
});