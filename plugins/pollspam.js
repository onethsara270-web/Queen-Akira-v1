// plugins/pollspam.js
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME     = "Queen Zara";
const MAX_POLLS    = 20;
const DELAY_MS     = 500;
// ─────────────────────────────────────────

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ── Poll templates ───────────────────────
const POLLS = [
    { name: 'Favorite Color', options: ['🔴 Red', '🔵 Blue', '🟢 Green', '🟡 Yellow'], selectable: 1 },
    { name: 'Best Food',      options: ['🍕 Pizza', '🍔 Burger', '🍣 Sushi', '🍝 Pasta'], selectable: 1 },
    { name: 'Favorite Animal', options: ['🐶 Dog', '🐱 Cat', '🐦 Bird', '🐟 Fish'], selectable: 1 },
    { name: 'Best Movie Genre', options: ['🎬 Action', '😂 Comedy', '🎭 Drama', '👻 Horror'], selectable: 1 },
    { name: 'Favorite Sport', options: ['🏏 Cricket', '⚽ Football', '🎾 Tennis', '🏀 Basketball'], selectable: 1 },
    { name: 'Best Season',    options: ['☀️ Summer', '❄️ Winter', '🌸 Spring', '🍂 Autumn'], selectable: 1 },
    { name: 'Favorite Music', options: ['🎤 Pop', '🎸 Rock', '🎻 Classical', '🎧 Hip Hop'], selectable: 1 },
    { name: 'Best Drink',     options: ['☕ Coffee', '🍵 Tea', '🧃 Juice', '🥤 Soda'], selectable: 1 },
    { name: 'Pick multiple',  options: ['A', 'B', 'C', 'D'], selectable: 2 },
    { name: 'Rate this bot',  options: ['⭐ 1', '⭐⭐ 2', '⭐⭐⭐ 3', '⭐⭐⭐⭐ 4', '⭐⭐⭐⭐⭐ 5'], selectable: 1 }
];

cmd({
    pattern: "pollspam",
    alias: ["pollbomb", "pspam"],
    use: '.pollspam <@mention | reply | number>',
    desc: "Send repeated polls to a target (owner only)",
    category: "owner",
    react: "🗳️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isCreator, isOwner, mentionedJid }) => {

    // ── Owner only ──────────────────────────
    if (!isCreator && !isOwner) {
        await conn.sendMessage(from, { react: { text: '⛔', key: mek.key } }).catch(() => {});
        return reply('❌ *Owner only!*');
    }

    // ── Resolve target ──────────────────────
    const ctx       = m.message?.extendedTextMessage?.contextInfo || {};
    const mentioned = mentionedJid?.[0] || ctx.mentionedJid?.[0];
    const quoted    = ctx.participant;
    const digits    = (q || '').replace(/\D/g, '');

    let target;
    if (digits.length >= 8)     target = jidNormalizedUser(`${digits}@s.whatsapp.net`);
    else if (mentioned)         target = jidNormalizedUser(mentioned);
    else if (quoted)            target = jidNormalizedUser(quoted);

    if (!target) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `⚠️ *Usage:* .pollspam [@mention | reply | number]\n\n` +
            `📌 *Example:*\n` +
            `.pollspam @94703945265\n` +
            `.pollspam 94703945265`
        );
    }

    const targetNumber = target.split('@')[0];

    try {
        const statusMsg = await conn.sendMessage(from, {
            text: `🗳️ *Sending polls to @${targetNumber}...*`,
            mentions: [target]
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── Send loop ───────────────────────
        let sent   = 0;
        let failed = 0;

        for (let i = 0; i < MAX_POLLS; i++) {
            const tpl = POLLS[i % POLLS.length];
            try {
                await conn.sendMessage(target, {
                    poll: {
                        name: `${tpl.name} 🗳️ #${i + 1}`,
                        values: tpl.options,
                        selectableCount: tpl.selectable
                    }
                });
                sent++;
            } catch (e) {
                failed++;
                console.error(`[pollspam] ${i + 1}/${MAX_POLLS}:`, e.message);
            }
            await delay(DELAY_MS);
        }

        // ── Report ──────────────────────────
        await reply(
            `🗳️ *POLL SPAM DONE*\n\n` +
            `📱 *Target:* @${targetNumber}\n` +
            `✅ *Sent:* ${sent}\n` +
            `❌ *Failed:* ${failed}\n\n` +
            `⚡ Powered by ${BOT_NAME}`
        );

        await conn.sendMessage(from, { react: { text: sent ? '✅' : '❌', key: mek.key } }).catch(() => {});

        // ── Cleanup status ──────────────────
        await delay(3000);
        await conn.sendMessage(from, { delete: statusMsg.key }).catch(() => {});

    } catch (e) {
        console.error('[pollspam]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* ${e.message}`);
    }
});