// plugins/hack.js
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
// ─────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

cmd({
    pattern: "hack",
    alias: ["h4ck", "hacking"],
    use: '.hack [@mention]',
    desc: "Fake hacking animation (owner only)",
    category: "owner",
    react: "💻",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, mentionedJid, isCreator, isOwner }) => {

    // ── Owner only ──────────────────────────
    if (!isCreator && !isOwner) {
        await conn.sendMessage(from, { react: { text: '⛔', key: mek.key } }).catch(() => {});
        return reply('❌ *Only the bot owner can use this command.*');
    }

    // ── Optional target ────────────────────
    const ctx = m.message?.extendedTextMessage?.contextInfo || {};
    const target =
        mentionedJid?.[0] ||
        ctx.mentionedJid?.[0] ||
        ctx.participant ||
        null;
    const targetNumber = target ? target.split('@')[0] : null;

    try {
        await conn.sendMessage(from, { react: { text: '💻', key: mek.key } }).catch(() => {});

        const header = targetNumber
            ? `💻 *HACKING @${targetNumber}...* 💻`
            : `💻 *HACK STARTING...* 💻`;

        const steps = [
            header,
            '*Initializing hacking tools...* 🛠️',
            '*Connecting to remote servers...* 🌐',
            '```[█▒▒▒▒▒▒▒▒] 10%``` ⏳',
            '```[███▒▒▒▒▒▒] 30%``` ⏳',
            '```[█████▒▒▒▒] 50%``` ⏳',
            '```[███████▒▒] 70%``` ⏳',
            '```[████████▒] 90%``` ⏳',
            '```[█████████] 100%``` ✅',
            '🔒 *System Breach: Successful!* 🔓',
            '🚀 *Executing final commands...* 🎯',
            '*📡 Transmitting data...* 📤',
            '_🕵️‍♂️ Covering tracks..._ 🤫',
            '*🔧 Finalizing operations...* 🏁',
            '> *HACK COMPLETE ☣*',
            `⚡ Powered by ${BOT_NAME}`
        ];

        for (const line of steps) {
            const payload = { text: line };
            if (target && line === header) {
                payload.mentions = [target];
            }
            await conn.sendMessage(from, payload, { quoted: mek });
            await sleep(Math.floor(Math.random() * 1500) + 500);
        }

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (err) {
        console.error('[hack]', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* ${err.message || String(err)}`);
    }
});