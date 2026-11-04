// plugins/dp.js
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME  = "Queen Zara";
const DEFAULT_PP = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
// ─────────────────────────────────────────

cmd({
    pattern: "dp",
    alias: ["getdp", "pp", "profilepic"],
    use: '.dp [@mention | reply]',
    desc: "Get user's profile picture",
    category: "tools",
    react: "🖼️",
    filename: __filename
}, async (conn, mek, m, { from, mentionedJid, sender }) => {

    // ── Resolve target ──────────────────────
    const ctx = m.message?.extendedTextMessage?.contextInfo || {};

    let target =
        mentionedJid?.[0]                 ||   // @mention
        ctx.mentionedJid?.[0]             ||
        ctx.participant                   ||   // reply
        null;

    if (!target) {
        // Group → sender; DM → the other party
        target = from.endsWith('@g.us')
            ? (mek.key.participant || mek.participant || sender)
            : from;
    }

    if (!target) target = sender || from;

    const number = target.split('@')[0];

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── Fetch PP (high-res → preview → default) ──
        let ppUrl = DEFAULT_PP;
        try {
            ppUrl = await conn.profilePictureUrl(target, 'image');
        } catch {
            try {
                ppUrl = await conn.profilePictureUrl(target, 'preview');
            } catch {
                ppUrl = DEFAULT_PP;
            }
        }

        // ── Send ─────────────────────────────
        await conn.sendMessage(from, {
            image: { url: ppUrl },
            caption:
                `✅ *Profile Picture*\n` +
                `👤 *User:* @${number}\n\n` +
                `⚡ Powered by ${BOT_NAME}`,
            mentions: [target]
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[dp]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        await conn.sendMessage(from, {
            text: `❌ *Error:* ${e.message}`
        }, { quoted: mek });
    }
});