// plugins/groupinfo.js
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME  = "Queen Zara";
const DEFAULT_PP = 'https://i.imgur.com/2wzGhpF.jpeg';
// ─────────────────────────────────────────

cmd({
    pattern: "groupinfo",
    alias: ["ginfo", "gcstat"],
    use: '.groupinfo',
    desc: "Show group information",
    category: "group",
    react: "📋",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup }) => {

    if (!isGroup) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('This command can only be used in groups.');
    }

    try {
        const meta = await conn.groupMetadata(from);
        const participants = meta.participants || [];

        // ── Admins ──────────────────────────
        const admins = participants.filter(p =>
            p.admin === 'admin' || p.admin === 'superadmin'
        );
        const adminList = admins.length
            ? admins.map((v, i) => `${i + 1}. @${v.id.split('@')[0]}`).join('\n')
            : '  None';

        // ── Owner ───────────────────────────
        const superAdmin = participants.find(p => p.admin === 'superadmin');
        const owner =
            meta.owner ||
            meta.subjectOwner ||
            superAdmin?.id ||
            null;
        const ownerDisplay = owner ? `@${owner.split('@')[0]}` : 'Not found';

        // ── Profile picture ─────────────────
        let pp = DEFAULT_PP;
        try { pp = await conn.profilePictureUrl(from, 'image'); }
        catch { pp = DEFAULT_PP; }

        // ── Description (object-safe) ───────
        let desc = 'No description';
        if (meta.desc) {
            desc = typeof meta.desc === 'string'
                ? meta.desc
                : (meta.desc.toString?.() || 'No description');
        }

        // ── Caption ─────────────────────────
        const text =
            `┌──「 *INFO GROUP* 」\n` +
            `▢ *♻️ID:*\n   • ${meta.id}\n` +
            `▢ *🔖NAME:*\n• ${meta.subject}\n` +
            `▢ *👥Members:*\n• ${participants.length}\n` +
            `▢ *🤿Group Owner:*\n• ${ownerDisplay}\n` +
            `▢ *🕵🏻‍♂️Admins:*\n${adminList}\n\n` +
            `▢ *📌Description:*\n   • ${desc}\n\n` +
            `⚡ Powered by ${BOT_NAME}`;

        // ── Mentions ────────────────────────
        const mentions = admins.map(v => v.id);
        if (owner) mentions.push(owner);

        await conn.sendMessage(from, {
            image: { url: pp },
            caption: text,
            mentions
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (error) {
        console.error('[groupinfo]', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Failed to get group info!*');
    }
});