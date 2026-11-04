// plugins/spam.js
const fs   = require('fs-extra');
const path = require('path');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME     = "Queen Zara";
const SPAM_FILE    = path.join(process.cwd(), 'spam.txt');
const DEFAULT_CNT  = 50;
const MAX_CNT      = 100;
const DELAY_MS     = 100;   // per message — WhatsApp rate limit safe
// ─────────────────────────────────────────

cmd({
    pattern: "spam",
    alias: ["spammer"],
    use: '.spam [count]',
    desc: "Repeatedly send spam.txt content to the current chat (owner only)",
    category: "owner",
    react: "📨",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isCreator, isOwner }) => {

    // ── Owner only ──────────────────────────
    if (!isCreator && !isOwner) {
        await conn.sendMessage(from, { react: { text: '⛔', key: mek.key } }).catch(() => {});
        return reply('❌ *Only the bot owner can use this command.*');
    }

    // ── File check ──────────────────────────
    if (!fs.existsSync(SPAM_FILE)) {
        await conn.sendMessage(from, { react: { text: '⚠️', key: mek.key } }).catch(() => {});
        return reply(
            `⚠️ *spam.txt not found!*\n\n` +
            `📌 Create *spam.txt* in the bot root directory.\n\n` +
            `📝 *Example content:*\nHello! This is a spam message.`
        );
    }

    const spamText = fs.readFileSync(SPAM_FILE, 'utf8').trim();
    if (!spamText) {
        await conn.sendMessage(from, { react: { text: '⚠️', key: mek.key } }).catch(() => {});
        return reply('⚠️ *spam.txt is empty.*');
    }

    // ── Count ───────────────────────────────
    const n = parseInt((q || '').trim(), 10);
    const count = Number.isFinite(n) && n > 0 ? Math.min(n, MAX_CNT) : DEFAULT_CNT;

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── Loop ────────────────────────────
        let sent = 0;
        let failed = 0;

        for (let i = 0; i < count; i++) {
            try {
                await conn.sendMessage(from, {
                    text: `${spamText}\n\n🔥 ${i + 1}/${count}`
                });
                sent++;
            } catch (e) {
                failed++;
                console.error(`[spam] ${i + 1}/${count}:`, e.message);
            }
            await new Promise(r => setTimeout(r, DELAY_MS));
        }

        // ── Report ──────────────────────────
        await reply(
            `📨 *SPAM COMPLETE*\n\n` +
            `✅ *Sent:* ${sent}/${count}\n` +
            `❌ *Failed:* ${failed}\n\n` +
            `⚡ Powered by ${BOT_NAME}`
        );
        await conn.sendMessage(from, { react: { text: sent ? '✅' : '❌', key: mek.key } }).catch(() => {});

    } catch (error) {
        console.error('[spam]', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* ${error.message}`);
    }
});